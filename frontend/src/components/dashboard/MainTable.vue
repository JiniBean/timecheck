<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import TimePicker from "./TimePicker.vue";
import SettingPicker from "./SettingPicker.vue";
import { useDaySettingsDraft } from "../../composables/useDaySettingsDraft";
import type { DayType, WeekDay } from "../../types/dashboard";
import { dayTypeCellLabel, isDayOff, mainMinutesLabel } from "../../utils/dayType";
import { compareHm, formatHm } from "../../utils/time";
import { WorkPolicy } from "../../utils/workPolicy";

const props = defineProps<{
  days: WeekDay[];
  todayWorkDate: string;
  todayMainMin: number;
  isLiveToday?: boolean;
}>();

const emit = defineEmits<{
  "update-check-in": [workDate: string, hhmm: string];
  "update-check-out": [workDate: string, hhmm: string];
  "clear-check-in": [workDate: string];
  "clear-check-out": [workDate: string];
  "save-day-settings": [
    payload: {
      workDate: string;
      dayType: DayType;
      isOt: boolean;
      remark: string | null;
    }
  ];
}>();

const TIME_PICKER_HINT_DEFAULT = "위·아래로 스크롤해 선택하세요";

const timePickerOpen = ref(false);
const timePickerInitial = ref("09:00");
const timePickerHint = ref(TIME_PICKER_HINT_DEFAULT);
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

function resolveCheckoutCell(day: WeekDay) {
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
      Boolean(props.isLiveToday && isToday && !dayOff && day.rawStart && !day.rawEnd);

    return {
      ...day,
      displayMain: isToday ? props.todayMainMin : day.main,
      isToday,
      dayOff,
      checkoutLabel: checkout.label,
      checkoutPreview: checkout.preview,
      workPreview
    };
  })
);

function hasTimeValue(day: WeekDay, field: "start" | "end"): boolean {
  if (field === "start") {
    return formatHm(day.rawStart) !== "-";
  }
  return Boolean(day.rawEnd) || resolveCheckoutCell(day).preview;
}

function resolvePickerInitial(day: WeekDay, field: "start" | "end"): string {
  const value = field === "start" ? day.rawStart : day.rawEnd;
  const formatted = formatHm(value);
  if (formatted !== "-") {
    return formatted;
  }
  if (field === "start" && day.dayType === "AM") {
    return WorkPolicy.HALF_DAY_HHMM;
  }
  if (field === "end" && day.dayType === "PM") {
    return WorkPolicy.HALF_DAY_HHMM;
  }
  return field === "end" ? "16:00" : "09:00";
}

function openTimePicker(day: WeekDay, field: "start" | "end") {
  if (isDayOff(day.dayType)) {
    return;
  }
  editingDay.value = day;
  timeEditField.value = field;
  timePickerHint.value = TIME_PICKER_HINT_DEFAULT;
  if (field === "end") {
    const checkout = resolveCheckoutCell(day);
    if (checkout.preview && day.mainEnd) {
      const mainEnd = formatHm(day.mainEnd);
      timePickerInitial.value = mainEnd !== "-" ? mainEnd : resolvePickerInitial(day, field);
    } else {
      timePickerInitial.value = resolvePickerInitial(day, field);
    }
  } else {
    timePickerInitial.value = resolvePickerInitial(day, field);
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
    emit("clear-check-in", workDate);
  } else {
    emit("clear-check-out", workDate);
  }
  editingDay.value = null;
}

function onTimeConfirm(hhmm: string) {
  if (!editingDay.value) {
    return;
  }
  if (
    timeEditField.value === "end" &&
    editingDay.value.dayType === "PM" &&
    compareHm(hhmm, WorkPolicy.HALF_DAY_HHMM) < 0
  ) {
    timePickerHint.value = `오후반차는 ${WorkPolicy.HALF_DAY_HHMM} 이후에만 퇴근할 수 있습니다.`;
    void nextTick(() => {
      timePickerOpen.value = true;
    });
    return;
  }
  const workDate = editingDay.value.workDate;
  if (timeEditField.value === "start") {
    emit("update-check-in", workDate, hhmm);
  } else {
    emit("update-check-out", workDate, hhmm);
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
            <th scope="col">출근</th>
            <th scope="col">퇴근</th>
            <th scope="col">근무</th>
            <th scope="col">유형</th>
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
                  'cell-preview': day.workPreview
                }"
              >
                {{ mainMinutesLabel(day.displayMain) }}
              </span>
            </td>
            <td class="cell-editable" @click="openDayTypeSheet(day)">
              <span :class="{ 'cell-day-type': day.dayType !== 'NOM' }">
                {{ dayTypeCellLabel(day.dayType) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <TimePicker
      v-model:open="timePickerOpen"
      :initial-time="timePickerInitial"
      :hint="timePickerHint"
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

.cell-day-type {
  color: var(--color-text-muted);
  font-size: var(--font-sm);
  font-weight: var(--weight-medium);
}
</style>
