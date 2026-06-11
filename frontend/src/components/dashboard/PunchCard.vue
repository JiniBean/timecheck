<script setup lang="ts">
import { computed, ref } from "vue";
import TimePicker from "./TimePicker.vue";
import SettingPicker from "./SettingPicker.vue";
import type { DayType, TodayStatus } from "../../types/dashboard";
import { DAY_TYPE_OPTIONS, isDayOff } from "../../utils/dayType";
import { formatHm } from "../../utils/time";

const props = defineProps<{
  status: TodayStatus;
  loading: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  dayType: DayType;
  isOt: boolean;
  remark: string | null;
  displayMainEnd: string | null;
  displayOtStart: string | null;
  hasCheckIn: boolean;
  actionTimeDisplay: string;
  isActionTimeEditable: boolean;
  isActionTimeLocked: boolean;
  errorMessage: string | null;
  toastMessage: string | null;
}>();

const emit = defineEmits<{
  checkIn: [];
  checkOut: [];
  applySettings: [payload: { dayType: DayType; isOt: boolean; remark: string | null }];
  updateMainEnd: [value: string];
  updateOtStart: [value: string];
  saveSettings: [];
  applyPickedTime: [value: string];
}>();

const timePickerOpen = ref(false);
const settingsOpen = ref(false);
const dayTypeDraft = ref<DayType>("NOM");
const otDraft = ref(false);
const remarkDraft = ref("");
const inlineOtPickerOpen = ref(false);
const inlineOtField = ref<"mainEnd" | "otStart">("mainEnd");
const inlineOtInitial = ref("18:00");

const statusText = computed(() => {
  if (props.status === "DONE") return "퇴근 완료";
  if (props.status === "WORKING") return "근무 중";
  return "출근 전";
});
const statusClass = computed(() => `status-badge status-${props.status.toLowerCase()}`);

const dayTypeLabel = computed(
  () => DAY_TYPE_OPTIONS.find((v) => v.value === props.dayType)?.label ?? "일반근무"
);

const showInlineOtTimes = computed(() => props.isOt && props.hasCheckIn);

const otTimesEditable = computed(() => props.isOt && props.hasCheckIn);

const otTimesPreview = computed(() => props.isOt && props.hasCheckIn && props.status === "WORKING");

const checkInButtonClass = computed(() =>
  props.status === "BEFORE_CHECK_IN"
    ? "button button-primary button-compact"
    : "button button-outline button-compact"
);

const checkOutButtonClass = computed(() =>
  props.status === "WORKING"
    ? "button button-primary button-compact"
    : "button button-outline button-compact"
);

function onTimeRowClick() {
  if (!props.isActionTimeEditable) {
    return;
  }
  timePickerOpen.value = true;
}

function openSettings() {
  dayTypeDraft.value = props.dayType;
  otDraft.value = props.isOt;
  remarkDraft.value = props.remark ?? "";
  settingsOpen.value = true;
}

function onUpdateDayType(dayType: DayType) {
  dayTypeDraft.value = dayType;
  if (isDayOff(dayType)) {
    otDraft.value = false;
  }
}

function onToggleOt() {
  if (isDayOff(dayTypeDraft.value)) {
    return;
  }
  otDraft.value = !otDraft.value;
}

function onUpdateRemark(value: string) {
  remarkDraft.value = value;
}

function onSettingsSave() {
  const showRemark =
    dayTypeDraft.value === "HOL" || (otDraft.value && !isDayOff(dayTypeDraft.value));
  emit("applySettings", {
    dayType: dayTypeDraft.value,
    isOt: isDayOff(dayTypeDraft.value) ? false : otDraft.value,
    remark: showRemark ? remarkDraft.value.trim() || null : null
  });
  emit("saveSettings");
}

function openInlineOtPicker(field: "mainEnd" | "otStart") {
  if (!otTimesEditable.value) {
    return;
  }
  inlineOtField.value = field;
  const current = field === "mainEnd" ? props.displayMainEnd : props.displayOtStart;
  const formatted = formatHm(current);
  inlineOtInitial.value = formatted === "-" ? "18:00" : formatted;
  inlineOtPickerOpen.value = true;
}

function onInlineOtConfirm(hhmm: string) {
  if (inlineOtField.value === "mainEnd") {
    emit("updateMainEnd", hhmm);
  } else {
    emit("updateOtStart", hhmm);
  }
  if (props.status === "DONE") {
    emit("saveSettings");
  }
}
</script>

<template>
  <section class="card punch-card">
    <Transition name="toast-fade">
      <p v-if="toastMessage" class="toast" role="status">{{ toastMessage }}</p>
    </Transition>

    <div class="card-head card-head-tight">
      <span :class="statusClass">{{ statusText }}</span>
      <button type="button" class="time-btn" :disabled="!isActionTimeEditable" @click="onTimeRowClick">
        <span>{{ actionTimeDisplay }}</span>
        <span class="caret" aria-hidden="true">▾</span>
      </button>
    </div>

    <div v-if="showInlineOtTimes" class="ot-row">
      <button
        type="button"
        class="ot-chip"
        :class="{ preview: otTimesPreview }"
        @click="openInlineOtPicker('mainEnd')"
      >
        <span class="ot-chip-label">퇴근</span>
        <span class="ot-chip-value">{{ formatHm(displayMainEnd) }}</span>
      </button>
      <button
        type="button"
        class="ot-chip"
        :class="{ preview: otTimesPreview }"
        @click="openInlineOtPicker('otStart')"
      >
        <span class="ot-chip-label">야근 시작</span>
        <span class="ot-chip-value">{{ formatHm(displayOtStart) }}</span>
      </button>
    </div>

    <div class="main-row">
      <div class="action-group action-horizontal">
        <button :class="checkInButtonClass" :disabled="!canCheckIn" @click="emit('checkIn')">출근</button>
        <button :class="checkOutButtonClass" :disabled="!canCheckOut" @click="emit('checkOut')">퇴근</button>
      </div>

      <div
        class="settings-row"
        role="button"
        tabindex="0"
        @click="openSettings"
        @keydown.enter="openSettings"
        @keydown.space.prevent="openSettings"
      >
        <div class="settings-text">
          <p class="settings-value">{{ dayTypeLabel }} · 야근 {{ isOt ? "ON" : "OFF" }}</p>
        </div>
        <span class="caret" aria-hidden="true">▾</span>
      </div>
    </div>

    <p v-if="errorMessage" class="error-note">{{ errorMessage }}</p>
    <p v-if="loading" class="card-note">처리 중입니다. 잠시만 기다려 주세요.</p>

    <TimePicker
      v-model:open="timePickerOpen"
      :initial-time="actionTimeDisplay"
      @confirm="emit('applyPickedTime', $event)"
    />

    <TimePicker
      v-model:open="inlineOtPickerOpen"
      :initial-time="inlineOtInitial"
      :title="inlineOtField === 'mainEnd' ? '일반 퇴근' : '야근 시작'"
      @confirm="onInlineOtConfirm"
    />

    <SettingPicker
      v-model:open="settingsOpen"
      title="근무 설정"
      :day-type="dayTypeDraft"
      :is-ot="otDraft"
      :remark="remarkDraft"
      @update-day-type="onUpdateDayType"
      @toggle-ot="onToggleOt"
      @update-remark="onUpdateRemark"
      @save="onSettingsSave"
    />
  </section>
</template>

<style scoped>
.punch-card {
  display: flex;
  flex-direction: column;
  gap: var(--mobile-inset-gap);
  --punch-status-action-gap: clamp(12px, 1.8vh, 16px);
}

.punch-card > .card-head-tight {
  margin-bottom: calc(var(--punch-status-action-gap) - var(--mobile-inset-gap));
}

.punch-card :deep(.status-badge) {
  padding: 3px 8px;
}

.toast {
  margin: 0 0 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background-color: #0f172a;
  color: #f8fafc;
  font-size: var(--font-sm);
  font-weight: 600;
  text-align: center;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: opacity 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
}

.time-btn {
  margin: 0;
  border: none;
  background: transparent;
  color: #334155;
  font-size: var(--font-lg);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  padding: 2px 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color 0.2s ease, transform 0.12s ease;
}

@media (hover: hover) and (pointer: fine) {
  .time-btn:hover {
    color: #0f172a;
  }
}

.time-btn:active {
  transform: translateY(1px);
}

.time-btn:disabled {
  cursor: default;
  color: #6b7280;
}

.ot-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--mobile-inset-gap);
}

.ot-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background-color: #f8fafc;
  cursor: pointer;
  text-align: left;
}

.ot-chip-label {
  color: #64748b;
  font-size: var(--font-xs);
  font-weight: 600;
}

.ot-chip-value {
  color: #0f172a;
  font-size: var(--font-lg);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.ot-chip.preview .ot-chip-value {
  color: #94a3b8;
  font-weight: 600;
}

.main-row {
  display: flex;
  flex-direction: column;
  gap: var(--mobile-inset-gap);
}

.action-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--mobile-inset-gap);
}

.action-group .button-compact {
  min-height: 48px;
  padding-block: 14px;
}

.settings-row {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 12px;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.settings-row:active {
  background-color: #f8fafc;
}

.settings-row:focus-visible {
  outline: 2px solid #93c5fd;
  outline-offset: 2px;
}

.settings-text {
  min-width: 0;
}

.settings-value {
  margin: 0;
  color: #0f172a;
  font-size: var(--font-base);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (min-width: 768px) {
  .settings-row {
    padding: 14px 14px;
    min-height: 48px;
  }

  .settings-value {
    white-space: normal;
  }

  .action-group .button-compact {
    min-height: 52px;
    padding-block: 15px;
  }
}

@media (min-width: 1024px) {
  .main-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--mobile-inset-gap);
  }
}
</style>
