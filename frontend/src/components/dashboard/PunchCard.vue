<script setup lang="ts">
import { computed, ref } from "vue";
import TimePicker from "./TimePicker.vue";
import SettingPicker from "./SettingPicker.vue";
import { useDaySettingsDraft } from "../../composables/useDaySettingsDraft";
import type { DayType, TodayStatus } from "../../types/dashboard";
import { DAY_TYPE_OPTIONS } from "../../utils/dayType";
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
  actTime: string;
  isActTimeEditable: boolean;
  isActTimeLocked: boolean;
  errorMessage: string | null;
  toastMessage: string | null;
}>();

const emit = defineEmits<{
  "check-in": [];
  "check-out": [];
  "apply-settings": [payload: { dayType: DayType; isOt: boolean; remark: string | null }];
  "update-main-end": [value: string];
  "update-ot-start": [value: string];
  "save-settings": [];
  "apply-picked-time": [value: string];
}>();

const timePickerOpen = ref(false);
const settingsOpen = ref(false);
const {
  dayTypeDraft,
  otDraft,
  remarkDraft,
  loadDraft,
  setDayType,
  onToggleOt,
  setRemark,
  buildPayload
} = useDaySettingsDraft();
const isOtPickerOpen = ref(false);
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
  if (!props.isActTimeEditable) {
    return;
  }
  timePickerOpen.value = true;
}

function openSettings() {
  loadDraft({
    dayType: props.dayType,
    isOt: props.isOt,
    remark: props.remark
  });
  settingsOpen.value = true;
}

function onSettingsSave() {
  emit("apply-settings", buildPayload());
  emit("save-settings");
}

function openInlineOtPicker(field: "mainEnd" | "otStart") {
  if (!otTimesEditable.value) {
    return;
  }
  inlineOtField.value = field;
  const current = field === "mainEnd" ? props.displayMainEnd : props.displayOtStart;
  const formatted = formatHm(current);
  inlineOtInitial.value = formatted === "-" ? "18:00" : formatted;
  isOtPickerOpen.value = true;
}

function onInlineOtConfirm(hhmm: string) {
  if (inlineOtField.value === "mainEnd") {
    emit("update-main-end", hhmm);
  } else {
    emit("update-ot-start", hhmm);
  }
  if (props.status === "DONE") {
    emit("save-settings");
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
      <button type="button" class="time-btn" :disabled="!isActTimeEditable" @click="onTimeRowClick">
        <span>{{ actTime }}</span>
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
        <button :class="checkInButtonClass" :disabled="!canCheckIn" @click="emit('check-in')">출근</button>
        <button :class="checkOutButtonClass" :disabled="!canCheckOut" @click="emit('check-out')">퇴근</button>
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
      :initial-time="actTime"
      @confirm="emit('apply-picked-time', $event)"
    />

    <TimePicker
      v-model:open="isOtPickerOpen"
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
      @update-day-type="setDayType"
      @toggle-ot="onToggleOt"
      @update-remark="setRemark"
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
  background-color: var(--color-text);
  color: var(--color-surface-muted);
  font-size: var(--font-sm);
  font-weight: var(--weight-semibold);
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
  color: var(--color-text-secondary);
  font-size: var(--font-lg);
  font-weight: var(--weight-semibold);
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
    color: var(--color-text);
  }
}

.time-btn:active {
  transform: translateY(1px);
}

.time-btn:disabled {
  cursor: default;
  color: var(--color-text-muted);
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
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background-color: var(--color-surface-muted);
  cursor: pointer;
  text-align: left;
}

.ot-chip-label {
  color: var(--color-text-muted);
  font-size: var(--font-xs);
  font-weight: var(--weight-semibold);
}

.ot-chip-value {
  color: var(--color-text);
  font-size: var(--font-lg);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.ot-chip.preview .ot-chip-value {
  color: var(--color-text-placeholder);
  font-weight: var(--weight-semibold);
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
  border: 1px solid var(--color-border);
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
  background-color: var(--color-surface-muted);
}

.settings-row:focus-visible {
  outline: 2px solid var(--color-primary-ring);
  outline-offset: 2px;
}

.settings-text {
  min-width: 0;
}

.settings-value {
  margin: 0;
  color: var(--color-text);
  font-size: var(--font-base);
  font-weight: var(--weight-semibold);
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
