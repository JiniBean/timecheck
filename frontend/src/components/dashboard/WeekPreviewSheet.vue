<script setup lang="ts">
import { computed, ref, watch } from "vue";
import TimePicker from "./TimePicker.vue";
import { fetchTodayWork, fetchWeeklyReport, fetchWorkRecordsInRange } from "../../api/dashboard";
import type { WeeklyReport, Work } from "../../types/dashboard";
import { computeTypicalCheckInHhmm, recentCheckInRange } from "../../utils/checkInAverage";
import { isDayOff } from "../../utils/dayType";
import { formatHm, formatHmFromMinutes } from "../../utils/time";
import { currentDateKey } from "../../utils/weekNav";
import { WorkPolicy } from "../../utils/workPolicy";
import {
  buildWeekPreview,
  formatPreviewCheckIn,
  formatPreviewCheckOut,
  formatPreviewWork,
  hhmmToDateTime,
  isPreviewCheckoutNextDay,
  type WeekPreviewOverrides,
  type WeekPreviewRow
} from "../../utils/weekPreview";

type ProjectedStartMode = "on-time" | "average" | "custom";
type PresetMode = "on-time" | "average";
type TimePickerContext = "row" | "summary";

const ON_TIME_HHMM = `${String(WorkPolicy.STD_START.hour).padStart(2, "0")}:${String(WorkPolicy.STD_START.minute).padStart(2, "0")}`;

const props = defineProps<{
  open: boolean;
  userId: number;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const loading = ref(false);
const weeklyReport = ref<WeeklyReport | null>(null);
const todayWork = ref<Work | null>(null);
const overrides = ref<WeekPreviewOverrides>({});

const projectedStartMode = ref<ProjectedStartMode>("on-time");
const projectedStartHhmm = ref(ON_TIME_HHMM);
const avgCheckInHhmm = ref<string | null>(null);
const lastPresetMode = ref<PresetMode>("on-time");

const timePickerOpen = ref(false);
const timePickerInitial = ref(ON_TIME_HHMM);
const timePickerContext = ref<TimePickerContext>("row");
const timeEditField = ref<"start" | "end">("start");
const editingRow = ref<WeekPreviewRow | null>(null);

const todayDateKey = computed(() => currentDateKey());

const preview = computed(() => {
  if (!weeklyReport.value || !todayWork.value) {
    return null;
  }
  return buildWeekPreview({
    weeklyReport: weeklyReport.value,
    todayWork: todayWork.value,
    todayDateKey: todayDateKey.value,
    overrides: overrides.value,
    projectedStartHhmm: projectedStartHhmm.value
  });
});

const timePickerTitle = computed(() => {
  if (timePickerContext.value === "summary") {
    return "예정 출근시간";
  }
  return timeEditField.value === "start" ? "출근 시간" : "퇴근 시간";
});

const presetToggleMuted = computed(() => projectedStartMode.value === "custom");
const canSelectAverage = computed(() => avgCheckInHhmm.value !== null);

const presetToggleAverage = computed(() => {
  if (projectedStartMode.value === "average") {
    return true;
  }
  if (projectedStartMode.value === "on-time") {
    return false;
  }
  return lastPresetMode.value === "average";
});

const balanceLabel = computed(() =>
  preview.value && preview.value.weekOverMinutes > 0 ? "남음" : "부족"
);

const balanceValue = computed(() => {
  if (!preview.value) {
    return "-";
  }
  return preview.value.weekOverMinutes > 0
    ? formatHmFromMinutes(preview.value.weekOverMinutes)
    : formatHmFromMinutes(preview.value.weekRemainingMinutes);
});

function resetProjectedStartState() {
  projectedStartMode.value = "on-time";
  projectedStartHhmm.value = ON_TIME_HHMM;
  avgCheckInHhmm.value = null;
  lastPresetMode.value = "on-time";
}

function clearStartOverrides() {
  if (!preview.value) {
    return;
  }
  const next = { ...overrides.value };
  for (const row of preview.value.rows) {
    if (!row.canEditCheckIn) {
      continue;
    }
    const entry = next[row.workDate];
    if (!entry?.rawStart) {
      continue;
    }
    const updated = { ...entry };
    delete updated.rawStart;
    if (!updated.rawEnd) {
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
      resetProjectedStartState();
      return;
    }

    loading.value = true;
    try {
      const range = recentCheckInRange(todayDateKey.value);
      const [weekly, today, rangeRecords] = await Promise.all([
        fetchWeeklyReport(props.userId, todayDateKey.value),
        fetchTodayWork(props.userId),
        fetchWorkRecordsInRange(props.userId, range.start, range.end)
      ]);
      weeklyReport.value = weekly;
      todayWork.value = today;
      overrides.value = {};
      resetProjectedStartState();
      avgCheckInHhmm.value = computeTypicalCheckInHhmm(rangeRecords);
    } finally {
      loading.value = false;
    }
  }
);

function closeSheet() {
  emit("update:open", false);
}

function resolvePickerInitial(row: WeekPreviewRow, field: "start" | "end"): string {
  const value = field === "start" ? row.rawStart : row.rawEnd;
  const formatted = formatHm(value);
  return formatted !== "-" ? formatted : field === "end" ? "18:00" : "09:00";
}

function openSummaryTimePicker() {
  timePickerContext.value = "summary";
  editingRow.value = null;
  timePickerInitial.value = projectedStartHhmm.value;
  timePickerOpen.value = true;
}

function selectOnTime() {
  lastPresetMode.value = "on-time";
  projectedStartMode.value = "on-time";
  projectedStartHhmm.value = ON_TIME_HHMM;
  clearStartOverrides();
}

function selectAverage() {
  if (!avgCheckInHhmm.value) {
    return;
  }
  lastPresetMode.value = "average";
  projectedStartMode.value = "average";
  projectedStartHhmm.value = avgCheckInHhmm.value;
  clearStartOverrides();
}

function restoreLastPreset() {
  if (lastPresetMode.value === "average") {
    selectAverage();
    return;
  }
  selectOnTime();
}

function handlePresetSelect(target: PresetMode) {
  if (projectedStartMode.value === "custom") {
    restoreLastPreset();
    return;
  }
  if (target === "on-time") {
    selectOnTime();
    return;
  }
  selectAverage();
}

function openTimePicker(row: WeekPreviewRow, field: "start" | "end") {
  if (field === "start" && !row.canEditCheckIn) {
    return;
  }
  if (field === "end" && !row.canEditCheckOut) {
    return;
  }
  if (isDayOff(row.dayType)) {
    return;
  }
  timePickerContext.value = "row";
  editingRow.value = row;
  timeEditField.value = field;
  timePickerInitial.value = resolvePickerInitial(row, field);
  timePickerOpen.value = true;
}

function onTimeConfirm(hhmm: string) {
  if (timePickerContext.value === "summary") {
    projectedStartMode.value = "custom";
    projectedStartHhmm.value = hhmm;
    clearStartOverrides();
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
    current.rawEnd = hhmmToDateTime(workDate, hhmm);
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
  return field === "start" ? Boolean(override.rawStart) : Boolean(override.rawEnd);
}

function cellToneClass(row: WeekPreviewRow, field: "start" | "end" | "work"): string {
  if (isDayOff(row.dayType)) {
    return "cell-tone-muted";
  }

  if (row.recordGap !== "none") {
    if (field === "work") {
      return "cell-tone-fixed";
    }
  }

  if (field === "start") {
    if (!row.canEditCheckIn) {
      return "cell-tone-fixed";
    }
    if (hasOverride(row.workDate, "start")) {
      return "cell-tone-edited";
    }
    if (row.isProjected) {
      return "cell-tone-projected";
    }
    return "cell-tone-edited";
  }

  if (field === "end") {
    if (!row.canEditCheckOut) {
      return "cell-tone-fixed";
    }
    if (hasOverride(row.workDate, "end")) {
      return "cell-tone-edited";
    }
    if (row.isProjected) {
      return "cell-tone-projected";
    }
    return "cell-tone-edited";
  }

  if (!row.isProjected && row.kind === "actual") {
    return "cell-tone-fixed";
  }
  if (hasOverride(row.workDate, "start") || hasOverride(row.workDate, "end")) {
    return "cell-tone-edited";
  }
  if (row.isProjected) {
    return "cell-tone-projected";
  }
  return "cell-tone-fixed";
}

function weekdayToneClass(row: WeekPreviewRow): string {
  if (isDayOff(row.dayType)) {
    return "cell-tone-muted";
  }
  if (!row.canEditCheckIn && !row.canEditCheckOut) {
    return "cell-tone-fixed";
  }
  return "cell-tone-weekday-preview";
}

function rowToneClass(row: WeekPreviewRow): string {
  if (row.canEditCheckIn || row.canEditCheckOut) {
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
            <h2 id="week-preview-title" class="week-preview-title">이번 주 미리보기</h2>
            <p v-if="weeklyReport" class="week-preview-subtitle">
              {{ weeklyReport.weekStart.slice(5).replace("-", "/") }} ~
              {{ weeklyReport.weekEnd.slice(5).replace("-", "/") }}
            </p>
          </div>
          <button type="button" class="week-preview-close" aria-label="닫기" @click="closeSheet">
            닫기
          </button>
        </header>

        <div v-if="loading" class="week-preview-loading">불러오는 중...</div>

        <template v-else-if="preview">
          <section class="week-preview-summary card">
            <div class="stat-row stat-row--3">
              <div class="stat-item">
                <p class="stat-label">총 근무</p>
                <p class="stat-value">{{ formatHmFromMinutes(preview.weekWorkedMinutes) }}</p>
              </div>
              <div class="stat-item stat-item--divider">
                <p class="stat-label">{{ balanceLabel }}</p>
                <p class="stat-value">{{ balanceValue }}</p>
              </div>
              <div class="stat-item stat-item--divider stat-item--projected-start">
                <p class="stat-label">예정 출근시간</p>
                <button
                  type="button"
                  class="stat-value stat-value--time"
                  aria-label="예정 출근시간 변경"
                  @click="openSummaryTimePicker"
                >
                  {{ projectedStartHhmm }}
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
                    @click="handlePresetSelect('on-time')"
                  >
                    정시
                  </button>
                  <button
                    type="button"
                    class="start-preset-switch__option"
                    :class="{ 'start-preset-switch__option--active': presetToggleAverage }"
                    :aria-pressed="presetToggleAverage"
                    :disabled="!canSelectAverage"
                    :title="canSelectAverage ? undefined : '최근 출근 기록 없음'"
                    @click="handlePresetSelect('average')"
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
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in preview.rows"
                  :key="row.workDate"
                  :class="[rowToneClass(row), { 'row-today': row.isToday }]"
                >
                  <th scope="row" :class="weekdayToneClass(row)">{{ row.weekdayLabel }}</th>
                  <td
                    :class="[cellToneClass(row, 'start'), { 'cell-editable': row.canEditCheckIn }]"
                    @click="openTimePicker(row, 'start')"
                  >
                    {{ formatPreviewCheckIn(row) }}
                  </td>
                  <td
                    :class="[cellToneClass(row, 'end'), { 'cell-editable': row.canEditCheckOut }]"
                    @click="openTimePicker(row, 'end')"
                  >
                    <template v-if="isPreviewCheckoutNextDay(row)">
                      {{ formatHm(row.rawEnd) }}<span class="cell-next-day">(+1)</span>
                    </template>
                    <template v-else>
                      {{ formatPreviewCheckOut(row) }}
                    </template>
                  </td>
                  <td>
                    <span :class="cellToneClass(row, 'work')">
                      {{ formatPreviewWork(row) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p class="week-preview-hint">시트를 닫으면 초기화됩니다.</p>
        </template>
      </div>
    </div>

    <TimePicker
      v-model:open="timePickerOpen"
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

.stat-item--projected-start {
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
  .row-today .cell-editable.cell-tone-projected:hover,
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

.cell-tone-projected {
  color: var(--color-preview-projected);
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

.row-today .cell-tone-fixed {
  color: var(--color-preview-today-fixed);
}

.row-today .cell-tone-projected {
  color: var(--color-preview-today-projected);
}

.row-today .cell-tone-edited {
  color: var(--color-preview-edited);
}

.week-preview-hint {
  margin: 12px 0 0;
  color: var(--color-text-placeholder);
  font-size: var(--font-sm);
  line-height: 1.4;
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
