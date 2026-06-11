<script setup lang="ts">
import { computed, ref } from "vue";
import TimePicker from "./TimePicker.vue";
import SettingPicker from "./SettingPicker.vue";
import type { DayType, WeeklyDayRow } from "../../types/dashboard";
import { isDayOff } from "../../utils/dayType";
import { formatHm, formatHmFromMinutes } from "../../utils/time";
import { dayExtraTotal, resolveDayExtraMinutes, type TodayExtraMinutes } from "../../utils/ot";

interface TodayOtContext {
  extra1: number;
  extra2: number;
  otStart: string | null;
  otEnd: string | null;
}

const props = defineProps<{
  days: WeeklyDayRow[];
  todayWorkDate: string;
  todayExtraMinutes?: TodayExtraMinutes;
  todayOtContext?: TodayOtContext;
  useLiveToday?: boolean;
}>();

const emit = defineEmits<{
  updateOtStart: [workDate: string, hhmm: string];
  updateOtEnd: [workDate: string, hhmm: string];
  clearOtStart: [workDate: string];
  clearOtEnd: [workDate: string];
  saveDaySettings: [
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
const editingDay = ref<WeeklyDayRow | null>(null);
const timePickerCanReset = ref(false);

const dayTypeSheetOpen = ref(false);
const dayTypeEditDay = ref<WeeklyDayRow | null>(null);
const dayTypeDraft = ref<DayType>("NOM");
const otDraft = ref(false);
const remarkDraft = ref("");

const displayDays = computed(() =>
  props.days.map((day) => {
    const isToday = day.workDate === props.todayWorkDate;
    const dayOff = isDayOff(day.dayType);
    const extra =
      props.useLiveToday && isToday
        ? resolveDayExtraMinutes(day, props.todayWorkDate, props.todayExtraMinutes)
        : { extra1: day.extra1, extra2: day.extra2 };
    const totalExtra = dayExtraTotal(extra);
    const hasOt = day.isOt && !dayOff;
    const useLive = Boolean(props.useLiveToday && isToday);

    const otStart = useLive ? props.todayOtContext?.otStart ?? day.otStart : day.otStart;
    const otEnd = useLive ? props.todayOtContext?.otEnd ?? day.otEnd : day.otEnd;

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
      durationLabel: dayOff || !hasOt ? "-" : formatHmFromMinutes(totalExtra)
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
    emit("clearOtStart", workDate);
  } else {
    emit("clearOtEnd", workDate);
  }
  editingDay.value = null;
}

function onTimeConfirm(hhmm: string) {
  if (!editingDay.value) {
    return;
  }
  const workDate = editingDay.value.workDate;
  if (timeEditField.value === "start") {
    emit("updateOtStart", workDate, hhmm);
  } else {
    emit("updateOtEnd", workDate, hhmm);
  }
  editingDay.value = null;
}

function openDayTypeSheet(day: WeeklyDayRow) {
  dayTypeEditDay.value = day;
  dayTypeDraft.value = day.dayType;
  otDraft.value = day.isOt;
  remarkDraft.value = day.remark ?? "";
  dayTypeSheetOpen.value = true;
}

function closeDayTypeSheet() {
  dayTypeSheetOpen.value = false;
  dayTypeEditDay.value = null;
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

function saveDaySettings() {
  if (!dayTypeEditDay.value) {
    return;
  }
  const showRemark = dayTypeDraft.value === "HOL" || (otDraft.value && !isDayOff(dayTypeDraft.value));
  const remark = showRemark ? remarkDraft.value.trim() || null : null;

  emit("saveDaySettings", {
    workDate: dayTypeEditDay.value.workDate,
    dayType: dayTypeDraft.value,
    isOt: isDayOff(dayTypeDraft.value) ? false : otDraft.value,
    remark
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
      @update-day-type="onUpdateDayType"
      @toggle-ot="onToggleOt"
      @update-remark="onUpdateRemark"
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
  border-bottom: 1px solid #e5e7eb;
}

.table thead th {
  color: #64748b;
  font-size: var(--font-sm);
  font-weight: 600;
  border-bottom: 1px solid #d1d5db;
}

.table tbody th[scope="row"] {
  color: #334155;
  font-weight: 700;
}

.row-today {
  background-color: #f0f9ff;
}

.row-today th,
.row-today td {
  color: #0f172a;
  font-weight: 600;
}

.cell-editable {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

@media (hover: hover) and (pointer: fine) {
  .cell-editable:hover {
    background-color: #f8fafc;
  }

  .cell-disabled:hover {
    background-color: transparent;
  }
}

.cell-disabled {
  cursor: default;
  color: #94a3b8;
}

.cell-preview {
  color: #cbd5e1;
  font-weight: 500;
}

.row-today .cell-preview {
  color: #94a3b8;
}
</style>
