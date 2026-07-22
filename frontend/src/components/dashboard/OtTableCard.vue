<script setup lang="ts">
import { computed, ref } from "vue";
import TimePicker from "./TimePicker.vue";
import SettingPicker from "./SettingPicker.vue";
import { useDaySettingsDraft } from "../../composables/useDaySettingsDraft";
import type { DayType, WeekDay } from "../../types/dashboard";
import { isDayOff } from "../../utils/dayType";
import { formatHm, fmtMinutes } from "../../utils/time";
import { dayExtraTotal, dayExtra, type DayExtra } from "../../utils/ot";

interface TodayOtContext {
  extra1: number;
  extra2: number;
  otStart: string | null;
  otEnd: string | null;
}

const props = defineProps<{
  days: WeekDay[];
  todayWorkDate: string;
  todayExtra?: DayExtra;
  otCtx?: TodayOtContext;
  isLiveToday?: boolean;
}>();

const emit = defineEmits<{
  "update-ot-start": [workDate: string, hhmm: string];
  "update-ot-end": [workDate: string, hhmm: string];
  "clear-ot-start": [workDate: string];
  "clear-ot-end": [workDate: string];
  "save-day-settings": [
    payload: {
      workDate: string;
      dayType: DayType;
      isOt: boolean;
      remark: string | null;
    }
  ];
}>();

const timePickerOpen = ref(false);
const timePickerInitial = ref("19:00");
const timeEditField = ref<"start" | "end">("start");
const editingDay = ref<WeekDay | null>(null);
const timePickerCanReset = ref(false);

const dayTypeSheetOpen = ref(false);
const dayTypeEditDay = ref<WeekDay | null>(null);

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

const displayDays = computed(() =>
  props.days.map((day) => {
    const isToday = day.workDate === props.todayWorkDate;
    const dayOff = isDayOff(day.dayType);
    const extra =
      props.isLiveToday && isToday
        ? dayExtra(day, props.todayWorkDate, props.todayExtra)
        : { extra1: day.extra1, extra2: day.extra2 };
    const totalExtra = dayExtraTotal(extra);
    const hasOt = day.isOt && !dayOff;
    const useLive = Boolean(props.isLiveToday && isToday);

    const otStart = useLive ? props.otCtx?.otStart ?? day.otStart : day.otStart;
    const otEnd = useLive ? props.otCtx?.otEnd ?? day.otEnd : day.otEnd;

    const otStartPreview = hasOt && !day.rawEnd && Boolean(otStart);
    const otEndPreview = hasOt && !day.rawEnd && Boolean(otEnd);
    const durationPreview = hasOt && !day.rawEnd && totalExtra > 0;

    return {
      ...day,
      isToday,
      dayOff,
      hasOt,
      otStart,
      otEnd,
      totalExtra,
      otStartPreview,
      otEndPreview,
      durationPreview,
      startLabel: dayOff || !hasOt ? "-" : formatHm(otStart),
      endLabel: dayOff || !hasOt ? "-" : formatHm(otEnd),
      durationLabel: dayOff || !hasOt || totalExtra <= 0 ? "-" : fmtMinutes(totalExtra)
    };
  })
);

function hasOtTimeValue(day: (typeof displayDays.value)[number], field: "start" | "end"): boolean {
  if (field === "start") {
    return day.startLabel !== "-";
  }
  return day.endLabel !== "-";
}

function openTimePicker(day: (typeof displayDays.value)[number], field: "start" | "end") {
  if (day.dayOff || !day.hasOt) {
    return;
  }
  editingDay.value = day;
  timeEditField.value = field;
  const value = field === "start" ? day.otStart : day.otEnd;
  const formatted = formatHm(value);
  timePickerInitial.value = formatted === "-" ? "19:00" : formatted;
  timePickerCanReset.value = hasOtTimeValue(day, field);
  timePickerOpen.value = true;
}

function onTimeReset() {
  if (!editingDay.value) {
    return;
  }
  const workDate = editingDay.value.workDate;
  if (timeEditField.value === "start") {
    emit("clear-ot-start", workDate);
  } else {
    emit("clear-ot-end", workDate);
  }
  editingDay.value = null;
}

function onTimeConfirm(hhmm: string) {
  if (!editingDay.value) {
    return;
  }
  const workDate = editingDay.value.workDate;
  if (timeEditField.value === "start") {
    emit("update-ot-start", workDate, hhmm);
  } else {
    emit("update-ot-end", workDate, hhmm);
  }
  editingDay.value = null;
}

function openDayTypeSheet(day: WeekDay) {
  dayTypeEditDay.value = day;
  loadDraft({
    dayType: day.dayType,
    isOt: day.isOt,
    remark: day.remark
  });
  dayTypeSheetOpen.value = true;
}

function closeDayTypeSheet() {
  dayTypeSheetOpen.value = false;
  dayTypeEditDay.value = null;
}

function saveDaySettings() {
  if (!dayTypeEditDay.value) {
    return;
  }
  const payload = buildPayload();
  emit("save-day-settings", {
    workDate: dayTypeEditDay.value.workDate,
    ...payload
  });
  closeDayTypeSheet();
}

const settingsTitle = computed(() =>
  dayTypeEditDay.value ? `${dayTypeEditDay.value.weekdayLabel}요일 · 근무 설정` : "근무 설정"
);
</script>

<template>
  <section class="card">
    <div class="table-wrap fill-table">
      <table class="table">
        <thead>
          <tr>
            <th scope="col">요일</th>
            <th scope="col">시작</th>
            <th scope="col">종료</th>
            <th scope="col">시간</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in displayDays" :key="day.workDate" :class="{ 'row-today': day.isToday }">
            <th scope="row" class="cell-editable" @click="openDayTypeSheet(day)">
              {{ day.weekdayLabel }}
            </th>
            <td
              class="cell-editable"
              :class="{
                'cell-disabled': day.dayOff || !day.hasOt,
                'cell-preview': day.otStartPreview
              }"
              @click="openTimePicker(day, 'start')"
            >
              {{ day.startLabel }}
            </td>
            <td
              class="cell-editable"
              :class="{
                'cell-disabled': day.dayOff || !day.hasOt,
                'cell-preview': day.otEndPreview
              }"
              @click="openTimePicker(day, 'end')"
            >
              {{ day.endLabel }}
            </td>
            <td :class="{ 'cell-preview': day.durationPreview }">{{ day.durationLabel }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <TimePicker
      v-model:open="timePickerOpen"
      :initial-time="timePickerInitial"
      :show-reset="timePickerCanReset"
      :title="timeEditField === 'start' ? '야근 시작' : '야근 종료'"
      @confirm="onTimeConfirm"
      @reset="onTimeReset"
    />

    <SettingPicker
      v-model:open="dayTypeSheetOpen"
      :title="settingsTitle"
      :day-type="dayTypeDraft"
      :is-ot="otDraft"
      :remark="remarkDraft"
      @update-day-type="setDayType"
      @toggle-ot="onToggleOt"
      @update-remark="setRemark"
      @save="saveDaySettings"
    />
  </section>
</template>

<style scoped>
.table-wrap {
  overflow: visible;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-base);
  font-variant-numeric: tabular-nums;
}

.table th,
.table td {
  padding: 8px 6px;
  text-align: center;
  border-bottom: 1px solid var(--color-border);
}

.table thead th {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  font-weight: var(--weight-semibold);
  border-bottom: 1px solid var(--color-border-strong);
}

.table tbody th[scope="row"] {
  color: var(--color-text-secondary);
  font-weight: var(--weight-semibold);
}

.row-today {
  background-color: var(--color-row-today);
}

.row-today th,
.row-today td {
  color: var(--color-text);
  font-weight: var(--weight-semibold);
}

.cell-editable {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

@media (hover: hover) and (pointer: fine) {
  .cell-editable:hover {
    background-color: var(--color-surface-muted);
  }

  .cell-disabled:hover {
    background-color: transparent;
  }
}

.cell-disabled {
  cursor: default;
  color: var(--color-text-placeholder);
}

.cell-preview {
  color: var(--color-text-disabled);
  font-weight: var(--weight-medium);
}

.row-today .cell-preview {
  color: var(--color-text-placeholder);
}
</style>
