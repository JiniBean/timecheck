<script setup lang="ts">
import { computed, ref } from "vue";
import TimePicker from "./TimePicker.vue";
import SettingPicker from "./SettingPicker.vue";
import type { DayType, WeeklyDayRow } from "../../types/dashboard";
import { isDayOff, workCellLabel } from "../../utils/dayType";
import { formatHm } from "../../utils/time";

const props = defineProps<{
  days: WeeklyDayRow[];
  todayWorkDate: string;
  todayWorkedMinutes: number;
  useLiveToday?: boolean;
}>();

const emit = defineEmits<{
  updateCheckIn: [workDate: string, hhmm: string];
  updateCheckOut: [workDate: string, hhmm: string];
  clearCheckIn: [workDate: string];
  clearCheckOut: [workDate: string];
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
const timePickerInitial = ref("09:00");
const timeEditField = ref<"start" | "end">("start");
const editingDay = ref<WeeklyDayRow | null>(null);
const timePickerCanReset = ref(false);

const dayTypeSheetOpen = ref(false);
const dayTypeEditDay = ref<WeeklyDayRow | null>(null);
const dayTypeDraft = ref<DayType>("NOM");
const otDraft = ref(false);
const remarkDraft = ref("");

function resolveCheckoutCell(day: WeeklyDayRow) {
  if (isDayOff(day.dayType)) {
    return { label: "-", preview: false };
  }
  if (day.rawEnd) {
    return { label: formatHm(day.rawEnd), preview: false };
  }
  if (day.isOt && day.rawStart && day.mainEnd) {
    return { label: formatHm(day.mainEnd), preview: true };
  }
  return { label: "-", preview: false };
}

const displayDays = computed(() =>
  props.days.map((day) => {
    const checkout = resolveCheckoutCell(day);
    const isToday = day.workDate === props.todayWorkDate;
    const dayOff = isDayOff(day.dayType);
    const workPreview =
      Boolean(props.useLiveToday && isToday && !dayOff && day.rawStart && !day.rawEnd);

    return {
      ...day,
      displayMain: isToday ? props.todayWorkedMinutes : day.main,
      isToday,
      dayOff,
      checkoutLabel: checkout.label,
      checkoutPreview: checkout.preview,
      workPreview
    };
  })
);

function hasTimeValue(day: WeeklyDayRow, field: "start" | "end"): boolean {
  if (field === "start") {
    return formatHm(day.rawStart) !== "-";
  }
  return Boolean(day.rawEnd) || resolveCheckoutCell(day).preview;
}

function resolvePickerInitial(value: string | null, field: "start" | "end"): string {
  const formatted = formatHm(value);
  if (formatted !== "-") {
    return formatted;
  }
  return field === "end" ? "16:00" : "09:00";
}

function openTimePicker(day: WeeklyDayRow, field: "start" | "end") {
  if (isDayOff(day.dayType)) {
    return;
  }
  editingDay.value = day;
  timeEditField.value = field;
  if (field === "start") {
    timePickerInitial.value = resolvePickerInitial(day.rawStart, field);
  } else {
    const checkout = resolveCheckoutCell(day);
    timePickerInitial.value =
      checkout.preview && day.mainEnd
        ? resolvePickerInitial(day.mainEnd, field)
        : resolvePickerInitial(day.rawEnd, field);
  }
  timePickerCanReset.value = hasTimeValue(day, field);
  timePickerOpen.value = true;
}

function onTimeReset() {
  if (!editingDay.value) {
    return;
  }
  const workDate = editingDay.value.workDate;
  if (timeEditField.value === "start") {
    emit("clearCheckIn", workDate);
  } else {
    emit("clearCheckOut", workDate);
  }
  editingDay.value = null;
}

function onTimeConfirm(hhmm: string) {
  if (!editingDay.value) {
    return;
  }
  const workDate = editingDay.value.workDate;
  if (timeEditField.value === "start") {
    emit("updateCheckIn", workDate, hhmm);
  } else {
    emit("updateCheckOut", workDate, hhmm);
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
            <th scope="col">출근</th>
            <th scope="col">퇴근</th>
            <th scope="col">근무</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="day in displayDays" :key="day.workDate" :class="{ 'row-today': day.isToday }">
            <th scope="row" class="cell-editable" @click="openDayTypeSheet(day)">
              {{ day.weekdayLabel }}
            </th>
            <td
              class="cell-editable"
              :class="{ 'cell-disabled': day.dayOff }"
              @click="openTimePicker(day, 'start')"
            >
              {{ day.dayOff ? "-" : formatHm(day.rawStart) }}
            </td>
            <td
              class="cell-editable"
              :class="{
                'cell-disabled': day.dayOff,
                'cell-preview': day.checkoutPreview
              }"
              @click="openTimePicker(day, 'end')"
            >
              {{ day.dayOff ? "-" : day.checkoutLabel }}
            </td>
            <td>
              <span
                :class="{
                  'cell-dayoff': day.dayOff,
                  'cell-preview': day.workPreview
                }"
              >
                {{ workCellLabel(day.dayType, day.displayMain) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <TimePicker
      v-model:open="timePickerOpen"
      :initial-time="timePickerInitial"
      :show-reset="timePickerCanReset"
      :title="timeEditField === 'start' ? '출근 시간' : '퇴근 시간'"
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

.cell-dayoff {
  color: #475569;
  font-weight: 500;
}
</style>
