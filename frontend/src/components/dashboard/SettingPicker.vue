<script setup lang="ts">
import { computed } from "vue";
import type { DayType } from "../../types/dashboard";
import { DAY_TYPE_OPTIONS, isDayOff } from "../../utils/dayType";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    dayType: DayType;
    isOt: boolean;
    remark: string | null;
    showOtTimeFields?: boolean;
  }>(),
  {
    showOtTimeFields: false
  }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  updateDayType: [value: DayType];
  toggleOt: [];
  updateRemark: [value: string];
  save: [];
}>();

const showRemarkField = computed(
  () => props.dayType === "HOL" || (props.isOt && !isDayOff(props.dayType))
);

const remarkFieldLabel = computed(() =>
  props.dayType === "HOL" ? "비고 (공휴일)" : "근무내역"
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
              :placeholder="dayType === 'HOL' ? '예: 개천절' : '예: 레포트 개발, 배포 테스트'"
              @input="onRemarkInput"
              @keydown.enter.prevent="saveSheet"
            />
          </label>
          <button type="button" class="button button-primary button-sm save" @click="saveSheet">저장</button>
        </div>
      </div>
    </div>
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
  background-color: rgba(15, 23, 42, 0.45);
}

.panel {
  width: min(100%, 420px);
  min-height: 248px;
  max-height: min(88dvh, 560px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border-radius: 16px;
  padding: 12px 14px 16px;
  box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.2);
}

.title {
  margin: 0 0 4px;
  font-size: var(--font-lg);
  font-weight: 700;
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
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 10px;
  background-color: #ffffff;
  color: #334155;
  font-size: var(--font-md);
  font-weight: 600;
  cursor: pointer;
}

.option.active {
  border-color: #0ea5e9;
  background-color: #f0f9ff;
  color: #0369a1;
}

.toggle {
  height: 40px;
}

.save {
  align-self: center;
  margin-top: 10px;
}
</style>
