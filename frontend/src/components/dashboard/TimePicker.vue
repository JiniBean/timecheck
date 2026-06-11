<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    initialTime?: string;
    title?: string;
    hint?: string;
    showReset?: boolean;
    zIndex?: number;
  }>(),
  {
    initialTime: "09:00",
    title: "시간 선택",
    hint: "위·아래로 스크롤해 선택하세요",
    showReset: false,
    zIndex: 200
  }
);

const emit = defineEmits<{
  confirm: [value: string];
  reset: [];
  "update:open": [value: boolean];
}>();

const ITEM = 48;
const sheetRef = ref<HTMLDivElement | null>(null);
const hCol = ref<HTMLDivElement | null>(null);
const mCol = ref<HTMLDivElement | null>(null);
const hourInputRef = ref<HTMLInputElement | null>(null);
const minuteInputRef = ref<HTMLInputElement | null>(null);
const editingUnit = ref<"h" | "m" | null>(null);
const inlineInput = ref("00");
const selectedHour = ref(0);
const selectedMinute = ref(0);
const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from({ length: 60 }, (_, i) => i);
let hSnapTimer: number | null = null;
let mSnapTimer: number | null = null;

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseHhMm(s: string): { h: number; m: number } {
  const t = s.trim();
  if (!t || t === "-") {
    return { h: 9, m: 0 };
  }
  const p = t.slice(0, 5);
  const [a, b] = p.split(":");
  const h = Math.min(23, Math.max(0, parseInt(a ?? "0", 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(b ?? "0", 10) || 0));
  return { h, m };
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      return;
    }
    const { h, m } = parseHhMm(props.initialTime);
    selectedHour.value = h;
    selectedMinute.value = m;
    editingUnit.value = null;
    await nextTick();
    if (hCol.value) {
      hCol.value.scrollTop = h * ITEM;
    }
    if (mCol.value) {
      mCol.value.scrollTop = m * ITEM;
    }
    sheetRef.value?.focus();
  }
);

function readScroll() {
  const hEl = hCol.value;
  const mEl = mCol.value;
  if (!hEl || !mEl) {
    return { h: 0, m: 0 };
  }
  const h = Math.min(23, Math.max(0, Math.round(hEl.scrollTop / ITEM)));
  const m = Math.min(59, Math.max(0, Math.round(mEl.scrollTop / ITEM)));
  return { h, m };
}

function snapColumn(el: HTMLDivElement | null, min: number, max: number, smooth = true) {
  if (!el) {
    return;
  }
  const index = Math.min(max, Math.max(min, Math.round(el.scrollTop / ITEM)));
  el.scrollTo({ top: index * ITEM, behavior: smooth ? "smooth" : "auto" });
}

function syncInputWithScroll() {
  const { h, m } = readScroll();
  selectedHour.value = h;
  selectedMinute.value = m;
  if (!editingUnit.value) {
    return;
  }
  inlineInput.value = String(editingUnit.value === "h" ? h : m).padStart(2, "0");
}

function stepColumn(el: HTMLDivElement | null, min: number, max: number, delta: number) {
  if (!el) {
    return;
  }
  const current = Math.min(max, Math.max(min, Math.round(el.scrollTop / ITEM)));
  const next = Math.min(max, Math.max(min, current + delta));
  el.scrollTop = next * ITEM;
}

function normalizeAndClamp(value: string, max: number): string {
  const digits = value.replace(/\D/g, "");
  const num = digits === "" ? 0 : Number.parseInt(digits, 10);
  const clamped = Math.min(max, Math.max(0, Number.isNaN(num) ? 0 : num));
  return String(clamped).padStart(2, "0");
}

function beginInlineEdit(unit: "h" | "m", value: number) {
  if (editingUnit.value && editingUnit.value !== unit) {
    commitInlineEdit();
  }
  editingUnit.value = unit;
  inlineInput.value = String(value).padStart(2, "0");
  void nextTick(() => {
    const input = unit === "h" ? hourInputRef.value : minuteInputRef.value;
    input?.focus();
    input?.select();
  });
}

function onHourItemClick(hour: number) {
  if (hCol.value) {
    hCol.value.scrollTop = hour * ITEM;
  }
  selectedHour.value = hour;
  beginInlineEdit("h", hour);
}

function onMinuteItemClick(minute: number) {
  if (mCol.value) {
    mCol.value.scrollTop = minute * ITEM;
  }
  selectedMinute.value = minute;
  beginInlineEdit("m", minute);
}

function onInlineInput(event: Event) {
  const value = (event.target as HTMLInputElement).value.replace(/\D/g, "").slice(0, 2);
  inlineInput.value = value;
}

function commitInlineEdit() {
  if (!editingUnit.value) {
    return;
  }
  const isHour = editingUnit.value === "h";
  const padded = normalizeAndClamp(inlineInput.value, isHour ? 23 : 59);
  const number = Number.parseInt(padded, 10);
  inlineInput.value = padded;
  if (isHour) {
    if (hCol.value) {
      hCol.value.scrollTop = number * ITEM;
    }
    selectedHour.value = number;
  } else if (mCol.value) {
    mCol.value.scrollTop = number * ITEM;
    selectedMinute.value = number;
  }
  editingUnit.value = null;
}

function cancelInlineEdit() {
  editingUnit.value = null;
}

function closePicker(save: boolean) {
  if (save) {
    commitInlineEdit();
    emit("confirm", formatTime(selectedHour.value, selectedMinute.value));
  } else {
    cancelInlineEdit();
  }
  emit("update:open", false);
}

function onInlineKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    closePicker(true);
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    cancelInlineEdit();
    return;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    const isHour = editingUnit.value === "h";
    const max = isHour ? 23 : 59;
    const current = Number.parseInt(normalizeAndClamp(inlineInput.value, max), 10);
    const next = Math.min(max, Math.max(0, current + (event.key === "ArrowUp" ? -1 : 1)));
    inlineInput.value = String(next).padStart(2, "0");
    if (isHour && hCol.value) {
      hCol.value.scrollTop = next * ITEM;
      selectedHour.value = next;
    }
    if (!isHour && mCol.value) {
      mCol.value.scrollTop = next * ITEM;
      selectedMinute.value = next;
    }
  }
}

function onHourScroll() {
  if (editingUnit.value === "h") {
    return;
  }
  if (hSnapTimer !== null) {
    clearTimeout(hSnapTimer);
  }
  hSnapTimer = window.setTimeout(() => {
    snapColumn(hCol.value, 0, 23);
    syncInputWithScroll();
  }, 70);
}

function onMinuteScroll() {
  if (editingUnit.value === "m") {
    return;
  }
  if (mSnapTimer !== null) {
    clearTimeout(mSnapTimer);
  }
  mSnapTimer = window.setTimeout(() => {
    snapColumn(mCol.value, 0, 59);
    syncInputWithScroll();
  }, 70);
}

function onHourWheel(event: WheelEvent) {
  event.preventDefault();
  if (editingUnit.value === "h") {
    commitInlineEdit();
  }
  stepColumn(hCol.value, 0, 23, event.deltaY > 0 ? 1 : -1);
  syncInputWithScroll();
}

function onMinuteWheel(event: WheelEvent) {
  event.preventDefault();
  if (editingUnit.value === "m") {
    commitInlineEdit();
  }
  stepColumn(mCol.value, 0, 59, event.deltaY > 0 ? 1 : -1);
  syncInputWithScroll();
}

function onHourKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    closePicker(true);
    return;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    stepColumn(hCol.value, 0, 23, event.key === "ArrowUp" ? -1 : 1);
    syncInputWithScroll();
  }
}

function onMinuteKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault();
    closePicker(true);
    return;
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    stepColumn(mCol.value, 0, 59, event.key === "ArrowUp" ? -1 : 1);
    syncInputWithScroll();
  }
}

function onSheetKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    if (editingUnit.value) {
      return;
    }
    event.preventDefault();
    closePicker(true);
  }
}

function resetPicker() {
  commitInlineEdit();
  emit("reset");
  emit("update:open", false);
}

onUnmounted(() => {
  if (hSnapTimer !== null) {
    clearTimeout(hSnapTimer);
  }
  if (mSnapTimer !== null) {
    clearTimeout(mSnapTimer);
  }
});
</script>

<template>
  <teleport to="body">
    <div
      v-show="open"
      class="backdrop"
      role="dialog"
      aria-modal="true"
      :style="{ zIndex: props.zIndex }"
      @click="closePicker(false)"
    >
      <div ref="sheetRef" class="panel" tabindex="-1" @click.stop @keydown="onSheetKeydown">
        <p class="title">{{ title }}</p>
        <p v-if="hint" class="hint">{{ hint }}</p>
        <div class="wheel" @touchmove.stop>
          <div class="wheel-highlight">
            <div class="wheel-highlight-cell">
              <input
                v-if="editingUnit === 'h'"
                ref="hourInputRef"
                class="wheel-input"
                inputmode="numeric"
                maxlength="2"
                :value="inlineInput"
                @mousedown.stop
                @input="onInlineInput"
                @keydown="onInlineKeydown"
              />
            </div>
            <span class="wheel-sep" aria-hidden="true">:</span>
            <div class="wheel-highlight-cell">
              <input
                v-if="editingUnit === 'm'"
                ref="minuteInputRef"
                class="wheel-input"
                inputmode="numeric"
                maxlength="2"
                :value="inlineInput"
                @mousedown.stop
                @input="onInlineInput"
                @keydown="onInlineKeydown"
              />
            </div>
          </div>
          <div class="wheel-columns">
            <div
              ref="hCol"
              class="wheel-col"
              tabindex="0"
              :style="{ height: 3 * ITEM + 'px' }"
              @scroll.passive="onHourScroll"
              @wheel="onHourWheel"
              @keydown="onHourKeydown"
            >
              <div class="wheel-pad" :style="{ height: ITEM + 'px' }" />
              <button
                v-for="h in hours"
                :key="h"
                type="button"
                class="wheel-item"
                @mousedown.prevent="onHourItemClick(h)"
              >
                <span :class="{ 'is-hidden': editingUnit === 'h' && selectedHour === h }">
                  {{ String(h).padStart(2, "0") }}
                </span>
              </button>
              <div class="wheel-pad" :style="{ height: ITEM + 'px' }" />
            </div>
            <span class="wheel-sep" aria-hidden="true">:</span>
            <div
              ref="mCol"
              class="wheel-col"
              tabindex="0"
              :style="{ height: 3 * ITEM + 'px' }"
              @scroll.passive="onMinuteScroll"
              @wheel="onMinuteWheel"
              @keydown="onMinuteKeydown"
            >
              <div class="wheel-pad" :style="{ height: ITEM + 'px' }" />
              <button
                v-for="m in minutes"
                :key="m"
                type="button"
                class="wheel-item"
                @mousedown.prevent="onMinuteItemClick(m)"
              >
                <span :class="{ 'is-hidden': editingUnit === 'm' && selectedMinute === m }">
                  {{ String(m).padStart(2, "0") }}
                </span>
              </button>
              <div class="wheel-pad" :style="{ height: ITEM + 'px' }" />
            </div>
          </div>
        </div>
        <div class="actions">
          <button v-if="showReset" type="button" class="button button-soft button-sm" @click="resetPicker">초기화</button>
          <button type="button" class="button button-primary button-sm" @click="closePicker(true)">확인</button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: rgba(15, 23, 42, 0.45);
}

.panel {
  width: min(100%, 420px);
  max-height: min(88dvh, 560px);
  overflow-y: auto;
  background-color: #ffffff;
  border-radius: 16px;
  padding: 12px 14px 16px;
  box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.2);
  outline: none;
}

.panel:focus,
.panel:focus-visible {
  outline: none;
}

.title {
  margin: 0 0 4px;
  font-size: var(--font-lg);
  font-weight: 700;
}

.hint {
  margin: 0 0 10px;
  color: #6b7280;
  font-size: var(--font-sm);
}

.wheel {
  position: relative;
  width: 100%;
  -webkit-tap-highlight-color: transparent;
}

.wheel-highlight,
.wheel-columns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.wheel-highlight {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  z-index: 2;
  height: var(--picker-item-h);
  padding: 0 4px;
  background-color: rgba(15, 23, 42, 0.05);
  border-radius: 8px;
  pointer-events: none;
  transform: translateY(-50%);
}

.wheel-highlight-cell {
  flex: 1;
  display: flex;
  justify-content: center;
}

.wheel-columns {
  position: relative;
  z-index: 1;
}

.wheel-col {
  flex: 1;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  scroll-snap-stop: always;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: pan-y;
  scrollbar-width: none;
  border-radius: 8px;
  -webkit-tap-highlight-color: transparent;
}

.wheel-col::-webkit-scrollbar {
  display: none;
}

.wheel-col:focus,
.wheel-col:focus-visible,
.wheel-item:focus,
.wheel-item:focus-visible,
.wheel-item:active,
.wheel-input:focus,
.wheel-input:focus-visible {
  outline: none;
  box-shadow: none;
}

.wheel-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--picker-item-h);
  border: none;
  background: transparent;
  font-size: var(--font-xl);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #1f2937;
  scroll-snap-align: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.wheel-item .is-hidden {
  opacity: 0;
}

.wheel-input {
  z-index: 3;
  width: 72px;
  height: 36px;
  padding: 0;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #ffffff;
  color: #0f172a;
  font-size: var(--font-lg);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  pointer-events: auto;
  caret-color: #0f172a;
}

.wheel-input::selection {
  background: transparent;
}

.wheel-pad {
  width: 100%;
}

.wheel-sep {
  padding: 0 2px;
  color: #6b7280;
  font-size: var(--font-xl);
  font-weight: 800;
  line-height: 1;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
}

.actions :deep(.button:focus),
.actions :deep(.button:focus-visible) {
  outline: none;
  box-shadow: none;
}
</style>
