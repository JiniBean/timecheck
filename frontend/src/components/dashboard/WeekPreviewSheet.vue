<script setup lang="ts">
import { computed, ref, watch } from "vue";
import TimePicker from "./TimePicker.vue";
import { fetchTodayWork, fetchWeeklyReport } from "../../api/dashboard";
import type { WeeklyReport, Work } from "../../types/dashboard";
import { isDayOff } from "../../utils/dayType";
import { formatHm, formatHmFromMinutes } from "../../utils/time";
import { currentDateKey } from "../../utils/weekNav";
import {
  buildWeekPreview,
  formatPreviewCheckIn,
  formatPreviewCheckOut,
  formatPreviewWork,
  hhmmToDateTime,
  type WeekPreviewOverrides,
  type WeekPreviewRow
} from "../../utils/weekPreview";

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

const timePickerOpen = ref(false);
const timePickerInitial = ref("09:00");
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
    overrides: overrides.value
  });
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

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      overrides.value = {};
      weeklyReport.value = null;
      todayWork.value = null;
      return;
    }

    loading.value = true;
    try {
      const [weekly, today] = await Promise.all([
        fetchWeeklyReport(props.userId, todayDateKey.value),
        fetchTodayWork(props.userId)
      ]);
      weeklyReport.value = weekly;
      todayWork.value = today;
      overrides.value = {};
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
  editingRow.value = row;
  timeEditField.value = field;
  timePickerInitial.value = resolvePickerInitial(row, field);
  timePickerOpen.value = true;
}

function onTimeConfirm(hhmm: string) {
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
              <div class="stat-item stat-item--divider">
                <p class="stat-label">하루 평균</p>
                <p class="stat-value">{{ formatHmFromMinutes(preview.avgRequiredPerDayMinutes) }}</p>
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
                    {{ formatPreviewCheckOut(row) }}
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
      :title="timeEditField === 'start' ? '출근 시간' : '퇴근 시간'"
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
  background-color: rgba(15, 23, 42, 0.45);
}

.week-preview-panel {
  width: 100%;
  max-width: 560px;
  max-height: min(92dvh, 720px);
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.2);
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
  font-weight: 700;
}

.week-preview-subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: var(--font-sm);
}

.week-preview-close {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background-color: #f1f5f9;
  color: #334155;
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
}

.week-preview-loading {
  padding: 24px 0;
  text-align: center;
  color: #64748b;
}

.week-preview-summary {
  margin-bottom: 12px;
  padding-block: 14px;
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
  border-bottom: 1px solid #e5e7eb;
}

.week-preview-table thead th {
  color: #64748b;
  font-size: var(--font-sm);
  font-weight: 600;
  border-bottom: 1px solid #d1d5db;
}

.week-preview-table tbody th[scope="row"] {
  color: #334155;
  font-weight: 700;
}

.row-tone-fixed {
  background-color: transparent;
}

.row-tone-preview {
  background-color: #fafbfc;
}

.row-today {
  background-color: #f0f9ff;
}

.row-today.row-tone-preview {
  background-color: #eff6ff;
}

.cell-editable {
  cursor: pointer;
}

@media (hover: hover) and (pointer: fine) {
  .week-preview-table tbody .cell-editable:hover,
  .row-today .cell-editable.cell-tone-projected:hover,
  .row-today .cell-editable.cell-tone-edited:hover {
    color: #1a1a1a;
  }

  .row-tone-preview .cell-editable:hover {
    background-color: rgba(255, 255, 255, 0.65);
  }

  .row-today.row-tone-preview .cell-editable:hover {
    background-color: rgba(255, 255, 255, 0.5);
  }
}

.cell-tone-fixed {
  color: #97a1ac;
  font-weight: 500;
}

.cell-tone-projected {
  color: #5a6674;
  font-weight: 500;
}

.cell-tone-edited {
  color: #333333;
  font-weight: 600;
}

.cell-tone-muted {
  color: #97a1ac;
  font-weight: 500;
}

.cell-tone-weekday-preview {
  color: #333333;
  font-weight: 700;
}

.row-today .cell-tone-fixed {
  color: #8a95a3;
}

.row-today .cell-tone-projected {
  color: #54606e;
}

.row-today .cell-tone-edited {
  color: #333333;
}

.week-preview-hint {
  margin: 12px 0 0;
  color: #94a3b8;
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
