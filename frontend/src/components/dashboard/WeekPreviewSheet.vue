<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import TimePicker from "./TimePicker.vue";
import { useDialogKeyboard } from "../../composables/useDialogKeyboard";
import {
  applyPreview as applyPreviewRequest,
  fetchWork,
  fetchWeek,
  fetchWorks
} from "../../api/dashboard";
import { localDateKey } from "../../utils/localDate";
import type { WeekReport, Work } from "../../types/dashboard";
import { typicalInHhmm as computeTypicalInHhmm, checkInRange } from "../../utils/checkInAverage";
import { isDayOff, dayTypeCellLabel } from "../../utils/dayType";
import { formatMonthDay } from "../../utils/main";
import { formatHm, formatMinutes, hhmmToDateTime } from "../../utils/time";
import {
  currentDateKey,
  formatWeekLabel,
  mondayOfDateKey,
  shiftDateKey
} from "../../utils/weekNav";
import { WorkPolicy } from "../../utils/workPolicy";
import { apiErrMsg } from "../../utils/apiError";
import { bootLog, bootWarn, bootError } from "../../utils/bootLog";
import {
  buildPreview,
  formatIn,
  formatOut,
  formatWork,
  isNextDay,
  loadPref,
  PREVIEW_START_MODE,
  PREVIEW_START_PRESET,
  previewStartFromPref,
  savePref,
  toPreviewRecords,
  type PreviewOverrides,
  type PreviewRow,
  type PreviewStartMode,
  type PreviewStartPreset
} from "../../utils/weekPreview";

type TimePickerContext = "row" | "summary";

const ON_TIME_HHMM = `${String(WorkPolicy.STD_START.hour).padStart(2, "0")}:${String(WorkPolicy.STD_START.minute).padStart(2, "0")}`;

const props = defineProps<{
  open: boolean;
  userId: number;
  referenceDate: string;
  asOf?: Date;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  apply: [weekStart: string];
}>();

const loading = ref(false);
const isApplying = ref(false);
const applyError = ref<string | null>(null);
const weeklyReport = ref<WeekReport | null>(null);
const todayWork = ref<Work | null>(null);
const overrides = ref<PreviewOverrides>({});

const previewStartMode = ref<PreviewStartMode>(PREVIEW_START_MODE.ON_TIME);
const previewStartHhmm = ref(ON_TIME_HHMM);
const typicalInHhmm = ref<string | null>(null);
const previewStartPreset = ref<PreviewStartPreset>(PREVIEW_START_PRESET.ON_TIME);

const isTimePickerOpen = ref(false);
const timePickerInitial = ref(ON_TIME_HHMM);
const timePickerContext = ref<TimePickerContext>("row");
const timeEditField = ref<"start" | "end">("start");
const editingRow = ref<PreviewRow | null>(null);

const todayDateKey = computed(() => currentDateKey());
const currentWeekStart = computed(() => mondayOfDateKey(todayDateKey.value));
const selectedWeekStart = computed(() => mondayOfDateKey(props.referenceDate));
const previewDateKey = computed(() =>
  selectedWeekStart.value > currentWeekStart.value
    ? selectedWeekStart.value
    : todayDateKey.value
);
const previewWeekStart = computed(() => mondayOfDateKey(previewDateKey.value));
const previewTitle = computed(() => {
  if (previewWeekStart.value === currentWeekStart.value) {
    return "이번 주 미리보기";
  }
  if (previewWeekStart.value === shiftDateKey(currentWeekStart.value, 7)) {
    return "다음 주 미리보기";
  }
  return `${formatWeekLabel(previewWeekStart.value)} 미리보기`;
});

const preview = computed(() => {
  if (!weeklyReport.value || !todayWork.value) {
    return null;
  }
  return buildPreview({
    weeklyReport: weeklyReport.value,
    todayWork: todayWork.value,
    todayDateKey: todayDateKey.value,
    overrides: overrides.value,
    previewStartHhmm: previewStartHhmm.value,
    asOf: props.asOf
  });
});

const previewRecords = computed(() => toPreviewRecords(preview.value?.rows ?? []));
const canApply = computed(() => previewRecords.value.length > 0 && !isApplying.value);

const timePickerTitle = computed(() => {
  if (timePickerContext.value === "summary") {
    return "예정 출근시간";
  }
  return timeEditField.value === "start" ? "출근 시간" : "퇴근 시간";
});

const presetToggleMuted = computed(() => previewStartMode.value === PREVIEW_START_MODE.CUSTOM);
const canSelectAverage = computed(() => typicalInHhmm.value !== null);

const presetToggleAverage = computed(() => {
  if (previewStartMode.value === PREVIEW_START_MODE.AVERAGE) {
    return true;
  }
  if (previewStartMode.value === PREVIEW_START_MODE.ON_TIME) {
    return false;
  }
  return previewStartPreset.value === PREVIEW_START_PRESET.AVERAGE;
});

const balanceLabel = computed(() =>
  preview.value && preview.value.weekOverMin > 0 ? "남음" : "부족"
);

const balanceValue = computed(() => {
  if (!preview.value) {
    return "-";
  }
  return preview.value.weekOverMin > 0
    ? formatMinutes(preview.value.weekOverMin)
    : formatMinutes(preview.value.weekRemMin);
});

function clearStartOverrides() {
  if (!preview.value) {
    return;
  }
  const next = { ...overrides.value };
  for (const row of preview.value.rows) {
    if (!row.canEditIn) {
      continue;
    }
    const entry = next[row.workDate];
    if (!entry?.rawStart) {
      continue;
    }
    const updated = { ...entry };
    delete updated.rawStart;
    if (!updated.mainEnd) {
      delete next[row.workDate];
    } else {
      next[row.workDate] = updated;
    }
  }
  overrides.value = next;
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      overrides.value = {};
      weeklyReport.value = null;
      todayWork.value = null;
      typicalInHhmm.value = null;
      applyError.value = null;
      return;
    }

    loading.value = true;
    applyError.value = null;
    const range = checkInRange(todayDateKey.value);
    bootLog("weekPreview:fetch:start", {
      userId: props.userId,
      weekRef: previewDateKey.value,
      workDate: localDateKey(),
      rangeStart: range.start,
      rangeEnd: range.end
    });
    try {
      const [weekly, today, rangeRecords] = await Promise.all([
        fetchWeek(props.userId, previewDateKey.value),
        fetchWork(props.userId, localDateKey()),
        fetchWorks(props.userId, range.start, range.end)
      ]);
      weeklyReport.value = weekly;
      todayWork.value = today;
      overrides.value = {};
      typicalInHhmm.value = computeTypicalInHhmm(rangeRecords);
      const next = previewStartFromPref(loadPref(props.userId), typicalInHhmm.value, ON_TIME_HHMM);
      previewStartMode.value = next.mode;
      previewStartHhmm.value = next.hhmm;
      previewStartPreset.value = next.preset;
      bootLog("weekPreview:fetch:done", {
        hasWeekly: weekly != null,
        weekDays: weekly?.days?.length ?? null,
        weekStart: weekly?.weekStart ?? null,
        todayWorkDate: today?.workDate ?? null,
        rangeCount: rangeRecords?.length ?? 0,
        typicalIn: typicalInHhmm.value
      });
    } catch (error) {
      bootError("weekPreview:fetch:fail", error, {
        weekRef: previewDateKey.value,
        workDate: localDateKey()
      });
    } finally {
      loading.value = false;
    }
  },
  { immediate: true }
);

watch(preview, (value) => {
  if (!props.open || loading.value) {
    return;
  }
  if (value === null) {
    bootWarn("weekPreview:empty", {
      hasWeekly: weeklyReport.value !== null,
      hasToday: todayWork.value !== null
    });
    return;
  }
  bootLog("weekPreview:rendered", { rows: value.rows.length });
});

function closeSheet() {
  if (isApplying.value) {
    return;
  }
  emit("update:open", false);
}

async function applyPreview() {
  if (!canApply.value) {
    return;
  }

  const records = previewRecords.value.map((record) => ({ ...record }));
  isApplying.value = true;
  applyError.value = null;
  try {
    const applied = await applyPreviewRequest(props.userId, records);
    emit("apply", applied.weekStart);
    emit("update:open", false);
  } catch (error) {
    applyError.value = apiErrMsg(error, "미리보기 적용에 실패했습니다.");
  } finally {
    isApplying.value = false;
  }
}

const dialogKeyboardDisabled = computed(() => isTimePickerOpen.value);

useDialogKeyboard({
  open: toRef(props, "open"),
  onClose: closeSheet,
  disabled: dialogKeyboardDisabled
});

function resolvePickerInitial(row: PreviewRow, field: "start" | "end"): string {
  const value = field === "start" ? row.rawStart : row.mainEnd;
  const formatted = formatHm(value);
  return formatted !== "-" ? formatted : field === "end" ? "18:00" : "09:00";
}

function openSummaryTimePicker() {
  if (isApplying.value) {
    return;
  }
  timePickerContext.value = "summary";
  editingRow.value = null;
  timePickerInitial.value = previewStartHhmm.value;
  isTimePickerOpen.value = true;
}

function selectOnTime() {
  if (isApplying.value) {
    return;
  }
  previewStartPreset.value = PREVIEW_START_PRESET.ON_TIME;
  previewStartMode.value = PREVIEW_START_MODE.ON_TIME;
  previewStartHhmm.value = ON_TIME_HHMM;
  clearStartOverrides();
  savePref(props.userId, {
    mode: PREVIEW_START_MODE.ON_TIME,
    lastPresetMode: PREVIEW_START_PRESET.ON_TIME
  });
}

function selectAverage() {
  if (isApplying.value || !typicalInHhmm.value) {
    return;
  }
  previewStartPreset.value = PREVIEW_START_PRESET.AVERAGE;
  previewStartMode.value = PREVIEW_START_MODE.AVERAGE;
  previewStartHhmm.value = typicalInHhmm.value;
  clearStartOverrides();
  savePref(props.userId, {
    mode: PREVIEW_START_MODE.AVERAGE,
    lastPresetMode: PREVIEW_START_PRESET.AVERAGE
  });
}

function handlePresetSelect(target: PreviewStartPreset) {
  if (previewStartMode.value === PREVIEW_START_MODE.CUSTOM) {
    if (previewStartPreset.value === PREVIEW_START_PRESET.AVERAGE) {
      selectAverage();
    } else {
      selectOnTime();
    }
    return;
  }
  if (target === PREVIEW_START_PRESET.ON_TIME) {
    selectOnTime();
    return;
  }
  selectAverage();
}

function openTimePicker(row: PreviewRow, field: "start" | "end") {
  if (isApplying.value) {
    return;
  }
  if (field === "start" && !row.canEditIn) {
    return;
  }
  if (field === "end" && !row.canEditOut) {
    return;
  }
  if (isDayOff(row.dayType)) {
    return;
  }
  timePickerContext.value = "row";
  editingRow.value = row;
  timeEditField.value = field;
  timePickerInitial.value = resolvePickerInitial(row, field);
  isTimePickerOpen.value = true;
}

function onTimeConfirm(hhmm: string) {
  if (timePickerContext.value === "summary") {
    previewStartMode.value = PREVIEW_START_MODE.CUSTOM;
    previewStartHhmm.value = hhmm;
    clearStartOverrides();
    savePref(props.userId, {
      mode: PREVIEW_START_MODE.CUSTOM,
      hhmm,
      lastPresetMode: previewStartPreset.value
    });
    return;
  }

  if (!editingRow.value) {
    return;
  }
  const workDate = editingRow.value.workDate;
  const current = { ...overrides.value[workDate] };

  if (timeEditField.value === "start") {
    current.rawStart = hhmmToDateTime(workDate, hhmm);
  } else {
    current.mainEnd = hhmmToDateTime(workDate, hhmm);
  }

  overrides.value = {
    ...overrides.value,
    [workDate]: current
  };
  editingRow.value = null;
}

function hasOverride(workDate: string, field: "start" | "end"): boolean {
  const override = overrides.value[workDate];
  if (!override) {
    return false;
  }
  return field === "start" ? Boolean(override.rawStart) : Boolean(override.mainEnd);
}

function cellToneClass(row: PreviewRow, field: "start" | "end" | "work"): string {
  if (isDayOff(row.dayType)) {
    return "cell-tone-muted";
  }

  if (row.missingGap !== "none") {
    if (field === "work") {
      return "cell-tone-fixed";
    }
  }

  if (field === "start") {
    if (!row.canEditIn) {
      return "cell-tone-fixed";
    }
    if (hasOverride(row.workDate, "start")) {
      return "cell-tone-edited";
    }
    if (row.kind === "prv") {
      return "cell-tone-prv";
    }
    return "cell-tone-edited";
  }

  if (field === "end") {
    if (!row.canEditOut) {
      return "cell-tone-fixed";
    }
    if (hasOverride(row.workDate, "end")) {
      return "cell-tone-edited";
    }
    if (row.kind === "prv") {
      return "cell-tone-prv";
    }
    return "cell-tone-edited";
  }

  if (row.kind === "fix") {
    return "cell-tone-fixed";
  }
  if (hasOverride(row.workDate, "start") || hasOverride(row.workDate, "end")) {
    return "cell-tone-edited";
  }
  if (row.kind === "prv") {
    return "cell-tone-prv";
  }
  return "cell-tone-fixed";
}

function weekdayToneClass(row: PreviewRow): string {
  if (isDayOff(row.dayType)) {
    return "cell-tone-muted";
  }
  if (!row.canEditIn && !row.canEditOut) {
    return "cell-tone-fixed";
  }
  return "cell-tone-weekday-preview";
}

function rowToneClass(row: PreviewRow): string {
  if (row.canEditIn || row.canEditOut) {
    return "row-tone-preview";
  }
  return "row-tone-fixed";
}

</script>

<template>
  <teleport to="body">
    <div
      v-show="open"
      class="week-preview-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="week-preview-title"
      @click.self="closeSheet"
    >
      <div class="week-preview-panel" @click.stop>
        <header class="week-preview-header">
          <div>
            <h2 id="week-preview-title" class="week-preview-title">{{ previewTitle }}</h2>
            <p v-if="weeklyReport" class="week-preview-subtitle">
              {{ weeklyReport.weekStart.slice(5).replace("-", "/") }} ~
              {{ weeklyReport.weekEnd.slice(5).replace("-", "/") }}
            </p>
          </div>
          <div class="week-preview-header-actions">
            <button
              type="button"
              class="button button-outline button-sm week-preview-apply"
              :disabled="!canApply"
              @click="applyPreview"
            >
              {{ isApplying ? "적용 중..." : "적용" }}
            </button>
            <button
              type="button"
              class="week-preview-close"
              aria-label="닫기"
              :disabled="isApplying"
              @click="closeSheet"
            >
              닫기
            </button>
          </div>
        </header>

        <div v-if="loading" class="week-preview-loading">불러오는 중...</div>

        <template v-else-if="preview">
          <section class="week-preview-summary card">
            <div class="stat-row stat-row--3">
              <div class="stat-item">
                <p class="stat-label">총 근무</p>
                <p class="stat-value">{{ formatMinutes(preview.weekWorkedMin) }}</p>
              </div>
              <div class="stat-item stat-item--divider">
                <p class="stat-label">{{ balanceLabel }}</p>
                <p class="stat-value">{{ balanceValue }}</p>
              </div>
              <div class="stat-item stat-item--divider stat-item--preview-start">
                <p class="stat-label">예정 출근시간</p>
                <button
                  type="button"
                  class="stat-value stat-value--time"
                  aria-label="예정 출근시간 변경"
                  :disabled="isApplying"
                  @click="openSummaryTimePicker"
                >
                  {{ previewStartHhmm }}
                </button>
                <div
                  class="start-preset-switch"
                  :class="{ 'start-preset-switch--muted': presetToggleMuted }"
                  role="group"
                  aria-label="예정 출근시간 프리셋"
                >
                  <div
                    class="start-preset-switch__indicator"
                    :class="{ 'start-preset-switch__indicator--right': presetToggleAverage }"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    class="start-preset-switch__option"
                    :class="{ 'start-preset-switch__option--active': !presetToggleAverage }"
                    :aria-pressed="!presetToggleAverage"
                    :disabled="isApplying"
                    @click="handlePresetSelect(PREVIEW_START_PRESET.ON_TIME)"
                  >
                    정시
                  </button>
                  <button
                    type="button"
                    class="start-preset-switch__option"
                    :class="{ 'start-preset-switch__option--active': presetToggleAverage }"
                    :aria-pressed="presetToggleAverage"
                    :disabled="isApplying || !canSelectAverage"
                    :title="canSelectAverage ? undefined : '최근 출근 기록 없음'"
                    @click="handlePresetSelect(PREVIEW_START_PRESET.AVERAGE)"
                  >
                    평균
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div class="week-preview-table-wrap">
            <table class="week-preview-table" aria-label="주간 근무 미리보기">
              <thead>
                <tr>
                  <th scope="col">요일</th>
                  <th scope="col">출근</th>
                  <th scope="col">퇴근</th>
                  <th scope="col">근무</th>
                  <th scope="col">유형</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in preview.rows"
                  :key="row.workDate"
                  :class="[rowToneClass(row), { 'row-today': row.isToday }]"
                >
                  <th scope="row" :class="weekdayToneClass(row)">
                    {{ row.weekdayLabel }}<span class="day-md">({{ formatMonthDay(row.workDate) }})</span>
                  </th>
                  <td
                    :class="[cellToneClass(row, 'start'), { 'cell-editable': row.canEditIn }]"
                    @click="openTimePicker(row, 'start')"
                  >
                    {{ formatIn(row) }}
                  </td>
                  <td
                    :class="[cellToneClass(row, 'end'), { 'cell-editable': row.canEditOut }]"
                    @click="openTimePicker(row, 'end')"
                  >
                    <template v-if="isNextDay(row)">
                      {{ formatHm(row.mainEnd) }}<span class="cell-next-day">(+1)</span>
                    </template>
                    <template v-else>
                      {{ formatOut(row) }}
                    </template>
                  </td>
                  <td>
                    <span :class="cellToneClass(row, 'work')">
                      {{ formatWork(row) }}
                    </span>
                  </td>
                  <td>
                    <span :class="{ 'cell-day-type': row.dayType !== 'NOM' }">
                      {{ dayTypeCellLabel(row.dayType) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="week-preview-actions">
            <p class="week-preview-hint">
              적용하면 오늘과 미래 출퇴근 시간이 완료 기록으로 저장됩니다.
            </p>
            <p v-if="applyError" class="week-preview-error" role="alert">{{ applyError }}</p>
          </div>
        </template>
      </div>
    </div>

    <TimePicker
      v-model:open="isTimePickerOpen"
      :initial-time="timePickerInitial"
      :z-index="220"
      :title="timePickerTitle"
      @confirm="onTimeConfirm"
    />
  </teleport>
</template>

<style scoped>
.week-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 210;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background-color: var(--color-overlay);
}

.week-preview-panel {
  width: 100%;
  max-width: 560px;
  max-height: min(92dvh, 720px);
  display: flex;
  flex-direction: column;
  background-color: var(--color-surface);
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 24px var(--color-shadow-modal);
  overflow-y: auto;
  overflow-x: hidden;
}

.week-preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.week-preview-title {
  margin: 0;
  font-size: var(--font-lg);
  font-weight: var(--weight-semibold);
}

.week-preview-subtitle {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: var(--font-sm);
}

.week-preview-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.week-preview-close {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background-color: var(--color-surface-subtle);
  color: var(--color-text-secondary);
  font-size: var(--font-sm);
  font-weight: var(--weight-semibold);
  cursor: pointer;
}

.week-preview-loading {
  padding: 24px 0;
  text-align: center;
  color: var(--color-text-muted);
}

.week-preview-summary {
  margin-bottom: 12px;
  padding-block: 14px;
}

.cell-next-day {
  color: var(--color-text-placeholder);
  font-weight: var(--weight-medium);
  font-size: 0.92em;
}

.stat-item--preview-start {
  gap: 4px;
}

.stat-value--time {
  margin: 4px 0 0;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-preview-edited);
  font-size: var(--font-base);
  font-weight: var(--weight-heavy);
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
  cursor: pointer;
}

.start-preset-switch {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  width: 100%;
  max-width: 104px;
  height: 26px;
  margin-top: 8px;
  padding: 2px;
  border-radius: 8px;
  background-color: var(--color-surface-muted, #eef1f6);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

.start-preset-switch--muted {
  background-color: var(--color-surface-subtle);
  box-shadow: inset 0 0 0 1px var(--color-border);
}

.start-preset-switch__indicator {
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(50% - 2px);
  height: calc(100% - 4px);
  border-radius: 6px;
  background-color: var(--color-surface);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 0 0 0.5px rgba(15, 23, 42, 0.04);
  transition: transform 0.24s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.start-preset-switch__indicator--right {
  transform: translateX(100%);
}

.start-preset-switch--muted .start-preset-switch__indicator {
  background-color: var(--color-surface);
  box-shadow: none;
  opacity: 0.72;
}

.start-preset-switch__option {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 10px;
  font-weight: var(--weight-semibold);
  letter-spacing: -0.01em;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}

.start-preset-switch__option--active {
  color: var(--color-text);
}

.start-preset-switch:not(.start-preset-switch--muted) .start-preset-switch__option--active {
  color: var(--color-primary-text);
}

.start-preset-switch--muted .start-preset-switch__option {
  color: var(--color-text-placeholder);
  cursor: pointer;
}

.start-preset-switch__option:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

@media (hover: hover) and (pointer: fine) {
  .start-preset-switch:not(.start-preset-switch--muted)
    .start-preset-switch__option:not(:disabled):not(.start-preset-switch__option--active):hover {
    color: var(--color-text-secondary);
  }
}

.week-preview-table-wrap {
  margin-bottom: 4px;
}

.week-preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-base);
  font-variant-numeric: tabular-nums;
}

.week-preview-table th,
.week-preview-table td {
  padding: 10px 6px;
  text-align: center;
  border-bottom: 1px solid var(--color-border);
}

.week-preview-table thead th {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  font-weight: var(--weight-semibold);
  border-bottom: 1px solid var(--color-border-strong);
}

.week-preview-table tbody th[scope="row"] {
  color: var(--color-text-secondary);
  font-weight: var(--weight-semibold);
}

.row-tone-fixed {
  background-color: transparent;
}

.row-tone-preview {
  background-color: var(--color-surface-preview);
}

.row-today {
  background-color: var(--color-row-today);
}

.row-today.row-tone-preview {
  background-color: var(--color-primary-soft);
}

.cell-editable {
  cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
  .week-preview-table tbody .cell-editable:hover,
  .row-today .cell-editable.cell-tone-prv:hover,
  .row-today .cell-editable.cell-tone-edited:hover {
    color: var(--color-text);
  }

  .row-tone-preview .cell-editable:hover {
    background-color: rgba(255, 255, 255, 0.65);
  }

  .row-today.row-tone-preview .cell-editable:hover {
    background-color: rgba(255, 255, 255, 0.5);
  }
}

.cell-tone-fixed {
  color: var(--color-preview-fixed);
  font-weight: var(--weight-medium);
}

.cell-tone-prv {
  color: var(--color-preview-prv);
  font-weight: var(--weight-medium);
}

.cell-tone-edited {
  color: var(--color-preview-edited);
  font-weight: var(--weight-semibold);
}

.cell-tone-muted {
  color: var(--color-preview-fixed);
  font-weight: var(--weight-medium);
}

.cell-tone-weekday-preview {
  color: var(--color-preview-edited);
  font-weight: var(--weight-semibold);
}

.day-md {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  font-weight: var(--weight-medium);
}

.row-today .day-md {
  color: var(--color-text-muted);
}

.row-today .cell-tone-fixed {
  color: var(--color-preview-today-fixed);
}

.row-today .cell-tone-prv {
  color: var(--color-preview-today-prv);
}

.row-today .cell-tone-edited {
  color: var(--color-preview-edited);
}

.week-preview-hint {
  margin: 0;
  color: var(--color-text-placeholder);
  font-size: var(--font-sm);
  line-height: 1.4;
}

.week-preview-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  text-align: center;
}

.week-preview-error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--font-sm);
  line-height: 1.4;
}

.week-preview-apply {
  min-width: 52px;
  padding-inline: 10px;
}

.cell-day-type {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  font-weight: var(--weight-medium);
}

@media (max-width: 767px) {
  .week-preview-panel {
    min-height: 50dvh;
  }
}

@media (min-width: 768px) {
  .week-preview-backdrop {
    align-items: center;
    padding: 16px;
  }

  .week-preview-panel {
    border-radius: 16px;
    max-height: min(88dvh, 680px);
  }
}
</style>
