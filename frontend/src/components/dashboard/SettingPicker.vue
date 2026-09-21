<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import type { DayType } from "../../types/dashboard";
import { DAY_TYPE_OPTIONS, isDayOff } from "../../utils/dayType";
import { WorkPolicy, hmOf } from "../../utils/workPolicy";
import { useDialogKeyboard } from "../../composables/useDialogKeyboard";
import TimePicker from "./TimePicker.vue";

type ShortField = "earlyOut" | "lateIn";

const props = defineProps<{
  open: boolean;
  title: string;
  dayType: DayType;
  isOt: boolean;
  remark: string | null;
  lateIn: string | null;
  earlyOut: string | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  updateDayType: [value: DayType];
  toggleOt: [];
  updateRemark: [value: string];
  updateLateIn: [value: string | null];
  updateEarlyOut: [value: string | null];
  save: [];
}>();

const isTimePickerOpen = ref(false);
const shortField = ref<ShortField | null>(null);
const timePickerInitial = ref<string>(hmOf(WorkPolicy.STD_END));

const canEditShortWork = computed(() => props.dayType === "NOM");
const hasShortWork = computed(() => Boolean(props.lateIn || props.earlyOut));
const isSheetKeyboardDisabled = computed(() => isTimePickerOpen.value);

const remarkMode = computed(() => {
  if (props.dayType === "HOL") {
    return "hol";
  }
  if (hasShortWork.value && !(props.isOt && !isDayOff(props.dayType))) {
    return "short";
  }
  if (props.isOt && !isDayOff(props.dayType)) {
    return "ot";
  }
  return null;
});

const showRemarkField = computed(() => remarkMode.value !== null);

const remarkFieldLabel = computed(() => {
  if (remarkMode.value === "hol") {
    return "비고 (공휴일)";
  }
  if (remarkMode.value === "short") {
    return "비고 (단축근무)";
  }
  return "근무내역";
});

const remarkPlaceholder = computed(() => {
  if (remarkMode.value === "hol") {
    return "예: 개천절, 추석 대체공휴일";
  }
  if (remarkMode.value === "short") {
    return "예: 추석연휴";
  }
  return "예: 레포트 개발, 배포 테스트";
});

const earlyOutLabel = computed(() =>
  props.earlyOut ? `조기퇴근 ${props.earlyOut.slice(0, 5)}` : "조기퇴근"
);

const lateInLabel = computed(() =>
  props.lateIn ? `늦은출근 ${props.lateIn.slice(0, 5)}` : "늦은출근"
);

const canToggleOt = computed(() => !isDayOff(props.dayType));

function closeSheet() {
  emit("update:open", false);
}

function saveSheet() {
  emit("save");
  emit("update:open", false);
}

function selectDayType(dayType: DayType) {
  emit("updateDayType", dayType);
}

function onRemarkInput(event: Event) {
  emit("updateRemark", (event.target as HTMLInputElement).value);
}

function openShortPicker(field: ShortField) {
  if (!canEditShortWork.value) {
    return;
  }
  shortField.value = field;
  if (field === "earlyOut") {
    timePickerInitial.value = props.earlyOut?.slice(0, 5) ?? hmOf(WorkPolicy.STD_END);
  } else {
    timePickerInitial.value = props.lateIn?.slice(0, 5) ?? hmOf(WorkPolicy.STD_START);
  }
  isTimePickerOpen.value = true;
}

function onShortTimeConfirm(hhmm: string) {
  const time = hhmm.slice(0, 5);
  if (shortField.value === "earlyOut") {
    emit("updateEarlyOut", time === hmOf(WorkPolicy.STD_END) ? null : time);
  } else if (shortField.value === "lateIn") {
    emit("updateLateIn", time === hmOf(WorkPolicy.STD_START) ? null : time);
  }
  shortField.value = null;
}

function onShortTimeReset() {
  if (shortField.value === "earlyOut") {
    emit("updateEarlyOut", null);
  } else if (shortField.value === "lateIn") {
    emit("updateLateIn", null);
  }
  shortField.value = null;
}

useDialogKeyboard({
  open: toRef(props, "open"),
  onClose: closeSheet,
  onSubmit: saveSheet,
  disabled: isSheetKeyboardDisabled
});
</script>

<template>
  <teleport to="body">
    <div v-show="open" class="backdrop" role="dialog" aria-modal="true" @click="closeSheet">
      <div class="panel" @click.stop>
        <p class="title">{{ title }}</p>
        <div class="body">
          <div class="options">
            <button
              v-for="option in DAY_TYPE_OPTIONS"
              :key="option.value"
              type="button"
              class="option"
              :class="{ active: dayType === option.value }"
              @click="selectDayType(option.value)"
            >
              {{ option.label }}
            </button>
            <button
              type="button"
              class="option"
              :class="{ active: Boolean(earlyOut) }"
              :disabled="!canEditShortWork"
              @click="openShortPicker('earlyOut')"
            >
              {{ earlyOutLabel }}
            </button>
            <button
              type="button"
              class="option"
              :class="{ active: Boolean(lateIn) }"
              :disabled="!canEditShortWork"
              @click="openShortPicker('lateIn')"
            >
              {{ lateInLabel }}
            </button>
          </div>

          <label class="field">
            <span class="field-label">야근</span>
            <button
              type="button"
              class="button button-soft toggle"
              :disabled="!canToggleOt"
              @click="emit('toggleOt')"
            >
              {{ isOt ? "ON" : "OFF" }}
            </button>
          </label>
          <label v-if="showRemarkField" class="field">
            <span class="field-label">{{ remarkFieldLabel }}</span>
            <input
              type="text"
              class="text-input"
              :value="remark ?? ''"
              :placeholder="remarkPlaceholder"
              @input="onRemarkInput"
              @keydown.enter.prevent="saveSheet"
            />
          </label>
          <button type="button" class="button button-primary button-sm save" @click="saveSheet">저장</button>
        </div>
      </div>
    </div>

    <TimePicker
      v-model:open="isTimePickerOpen"
      :initial-time="timePickerInitial"
      :title="shortField === 'lateIn' ? '늦은출근' : '조기퇴근'"
      :show-reset="shortField === 'earlyOut' ? Boolean(earlyOut) : Boolean(lateIn)"
      :z-index="300"
      @confirm="onShortTimeConfirm"
      @reset="onShortTimeReset"
    />
  </teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: var(--color-overlay);
}

.panel {
  width: min(100%, 420px);
  min-height: 248px;
  max-height: min(88dvh, 560px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface);
  border-radius: 16px;
  padding: 12px 14px 16px;
  box-shadow: 0 -4px 24px var(--color-shadow-modal);
}

.title {
  margin: 0 0 4px;
  font-size: var(--font-lg);
  font-weight: var(--weight-semibold);
}

.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  padding: 8px 0 4px;
}

.body .field {
  width: 100%;
  gap: 10px;
}

.body .text-input,
.toggle {
  width: 100%;
}

.options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.option {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px 10px;
  background-color: var(--color-surface);
  color: var(--color-text-secondary);
  font-size: var(--font-md);
  font-weight: var(--weight-semibold);
  cursor: pointer;
}

.option.active {
  border-color: var(--color-primary);
  background-color: var(--color-primary-soft);
  color: var(--color-primary-text);
}

.option:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.toggle {
  height: 40px;
}

.save {
  align-self: center;
  margin-top: 10px;
}
</style>
