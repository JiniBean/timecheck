import type { DayType, WeeklyDayRow, WeeklyReport, Work } from "../types/dashboard";
import { dayTypeLabel, isDayOff, workCellLabel } from "./dayType";
import { MAIN_WEEK_TARGET_MINUTES, computeAvgRequiredPerDay } from "./main";
import { computeMainMinutes } from "./ot";
import { formatHm } from "./time";
import {
  calculateWorkMinutes,
  resolveEffectiveTodayWork,
  type WorkCalcInput
} from "./timeCalculator";
import { WorkPolicy } from "./workPolicy";

export type PreviewRowKind = "actual" | "projected";

export interface WeekPreviewOverrides {
  [workDate: string]: {
    rawStart?: string;
    rawEnd?: string;
  };
}

export interface WeekPreviewRow {
  workDate: string;
  weekdayLabel: string;
  dayType: DayType;
  rawStart: string | null;
  rawEnd: string | null;
  mainMinutes: number;
  kind: PreviewRowKind;
  isToday: boolean;
  canEditCheckIn: boolean;
  canEditCheckOut: boolean;
  isProjected: boolean;
}

export interface WeekPreviewResult {
  rows: WeekPreviewRow[];
  weekWorkedMinutes: number;
  weekTargetMinutes: number;
  weekRemainingMinutes: number;
  weekOverMinutes: number;
  avgRequiredPerDayMinutes: number;
}

interface DayEditability {
  canEditCheckIn: boolean;
  canEditCheckOut: boolean;
  isFixed: boolean;
}

interface ResolvedDayTimes {
  rawStart: string | null;
  rawEnd: string | null;
  mainMinutes: number;
  isProjected: boolean;
  kind: PreviewRowKind;
}

function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(workDate: string, date: Date): string {
  return `${workDate} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function hhmmToDateTime(workDate: string, hhmm: string): string {
  const [h, m] = hhmm.slice(0, 5).split(":");
  return `${workDate} ${String(Number(h) || 0).padStart(2, "0")}:${String(Number(m) || 0).padStart(2, "0")}`;
}

function defaultProjectedStart(workDate: string, dayType: DayType): string {
  if (dayType === "AM") {
    return hhmmToDateTime(workDate, "14:00");
  }
  return hhmmToDateTime(workDate, "09:00");
}

function computeEndAtMainMinutes(
  workDate: string,
  rawStart: Date,
  dayType: DayType,
  targetMainMinutes: number
): Date {
  const target = Math.max(0, targetMainMinutes);
  let cursor = addMinutes(rawStart, 30);
  const maxEnd = addMinutes(rawStart, 16 * 60);

  while (cursor.getTime() <= maxEnd.getTime()) {
    if (computeMainMinutes(workDate, rawStart, cursor, dayType) >= target) {
      return cursor;
    }
    cursor = addMinutes(cursor, 1);
  }

  return maxEnd;
}

function calcInput(
  workDate: string,
  dayType: DayType,
  rawStart: string | null,
  rawEnd: string | null
): WorkCalcInput {
  return {
    workDate,
    rawStart,
    rawEnd,
    dayType,
    isOt: false
  };
}

function resolveMainMinutes(
  workDate: string,
  dayType: DayType,
  rawStart: string | null,
  rawEnd: string | null,
  fallback = 0
): number {
  if (isDayOff(dayType)) {
    return WorkPolicy.STD_WORK;
  }
  if (!rawStart || !rawEnd) {
    return fallback;
  }
  return calculateWorkMinutes(calcInput(workDate, dayType, rawStart, rawEnd)).main;
}

function resolveEditability(
  day: WeeklyDayRow,
  todayDate: string,
  effectiveToday: Work
): DayEditability {
  if (isDayOff(day.dayType)) {
    return { canEditCheckIn: false, canEditCheckOut: false, isFixed: true };
  }

  const workDate = day.workDate;
  if (workDate < todayDate) {
    return { canEditCheckIn: false, canEditCheckOut: false, isFixed: true };
  }

  const rawStart = workDate === todayDate ? effectiveToday.rawStart : day.rawStart;
  const rawEnd = workDate === todayDate ? effectiveToday.rawEnd : day.rawEnd;

  if (rawEnd) {
    return { canEditCheckIn: false, canEditCheckOut: false, isFixed: true };
  }
  if (rawStart) {
    return { canEditCheckIn: false, canEditCheckOut: true, isFixed: false };
  }
  return { canEditCheckIn: true, canEditCheckOut: true, isFixed: false };
}

function resolveActualTimes(
  day: WeeklyDayRow,
  todayDate: string,
  effectiveToday: Work
): ResolvedDayTimes {
  const isToday = day.workDate === todayDate;
  const rawStart = isToday ? effectiveToday.rawStart : day.rawStart;
  const rawEnd = isToday ? effectiveToday.rawEnd : day.rawEnd;
  const dayType = isToday ? effectiveToday.dayType : day.dayType;

  if (isDayOff(dayType)) {
    return {
      rawStart: null,
      rawEnd: null,
      mainMinutes: WorkPolicy.STD_WORK,
      isProjected: false,
      kind: "actual"
    };
  }

  const mainMinutes = resolveMainMinutes(day.workDate, dayType, rawStart, rawEnd, day.main);

  return {
    rawStart,
    rawEnd,
    mainMinutes,
    isProjected: false,
    kind: "actual"
  };
}

interface AutoDaySlot {
  day: WeeklyDayRow;
  edit: DayEditability;
  start: string;
  lockedEnd: string | null;
}

export function buildWeekPreview(input: {
  weeklyReport: WeeklyReport;
  todayWork: Work;
  todayDateKey: string;
  overrides?: WeekPreviewOverrides;
}): WeekPreviewResult {
  const { weeklyReport, todayWork, todayDateKey } = input;
  const overrides = input.overrides ?? {};
  const effectiveToday = resolveEffectiveTodayWork(todayWork, weeklyReport.days, todayDateKey);
  const targetMinutes = weeklyReport.summary.targetMinutes || MAIN_WEEK_TARGET_MINUTES;

  let fixedMinutes = 0;
  const autoSlots: AutoDaySlot[] = [];
  const resolved = new Map<string, ResolvedDayTimes>();

  for (const day of weeklyReport.days) {
    const edit = resolveEditability(day, todayDateKey, effectiveToday);
    const override = overrides[day.workDate];

    if (edit.isFixed) {
      const actual = resolveActualTimes(day, todayDateKey, effectiveToday);
      resolved.set(day.workDate, actual);
      fixedMinutes += actual.mainMinutes;
      continue;
    }

    if (isDayOff(day.dayType)) {
      const actual = resolveActualTimes(day, todayDateKey, effectiveToday);
      resolved.set(day.workDate, actual);
      fixedMinutes += WorkPolicy.STD_WORK;
      continue;
    }

    const isToday = day.workDate === todayDateKey;
    const baseStart = isToday ? effectiveToday.rawStart : day.rawStart;
    const dayType = isToday ? effectiveToday.dayType : day.dayType;

    const start = override?.rawStart ?? baseStart ?? defaultProjectedStart(day.workDate, dayType);
    const lockedEnd = override?.rawEnd ?? null;

    if (lockedEnd) {
      const mainMinutes = resolveMainMinutes(day.workDate, dayType, start, lockedEnd);
      fixedMinutes += mainMinutes;
      resolved.set(day.workDate, {
        rawStart: start,
        rawEnd: lockedEnd,
        mainMinutes,
        isProjected: true,
        kind: "projected"
      });
      continue;
    }

    autoSlots.push({ day, edit, start, lockedEnd: null });
  }

  // 어제까지 확정 실적 + 오늘 퇴근 저장분만 반영하고, 오늘 진행 중 분은 제외한 뒤 남은 일에 분배
  const weekRemaining = Math.max(0, targetMinutes - fixedMinutes);
  const perDayMinutes =
    autoSlots.length > 0
      ? computeAvgRequiredPerDay(weekRemaining, autoSlots.length)
      : 0;

  for (const slot of autoSlots) {
    const isToday = slot.day.workDate === todayDateKey;
    const dayType = isToday ? effectiveToday.dayType : slot.day.dayType;
    const startDt = parseDateTime(slot.start);
    if (!startDt) {
      resolved.set(slot.day.workDate, {
        rawStart: slot.start,
        rawEnd: null,
        mainMinutes: 0,
        isProjected: true,
        kind: "projected"
      });
      continue;
    }

    const endDt = computeEndAtMainMinutes(slot.day.workDate, startDt, dayType, perDayMinutes);
    const rawEnd = formatDateTime(slot.day.workDate, endDt);
    const mainMinutes = resolveMainMinutes(slot.day.workDate, dayType, slot.start, rawEnd);

    resolved.set(slot.day.workDate, {
      rawStart: slot.start,
      rawEnd,
      mainMinutes,
      isProjected: true,
      kind: "projected"
    });
  }

  const rows: WeekPreviewRow[] = weeklyReport.days.map((day) => {
    const edit = resolveEditability(day, todayDateKey, effectiveToday);
    const times = resolved.get(day.workDate)!;
    const isToday = day.workDate === todayDateKey;
    const dayType = isToday ? effectiveToday.dayType : day.dayType;

    return {
      workDate: day.workDate,
      weekdayLabel: day.weekdayLabel,
      dayType,
      rawStart: times.rawStart,
      rawEnd: times.rawEnd,
      mainMinutes: times.mainMinutes,
      kind: times.kind,
      isToday,
      canEditCheckIn: edit.canEditCheckIn,
      canEditCheckOut: edit.canEditCheckOut,
      isProjected: times.isProjected
    };
  });

  const weekWorkedMinutes = rows.reduce((sum, row) => sum + row.mainMinutes, 0);
  const weekRemainingMinutes = Math.max(0, targetMinutes - weekWorkedMinutes);
  const weekOverMinutes = Math.max(0, weekWorkedMinutes - targetMinutes);
  const avgRequiredPerDayMinutes = perDayMinutes;

  return {
    rows,
    weekWorkedMinutes,
    weekTargetMinutes: targetMinutes,
    weekRemainingMinutes,
    weekOverMinutes,
    avgRequiredPerDayMinutes
  };
}

export function formatPreviewCheckIn(row: WeekPreviewRow): string {
  if (isDayOff(row.dayType)) {
    return "-";
  }
  return formatHm(row.rawStart);
}

export function formatPreviewCheckOut(row: WeekPreviewRow): string {
  if (isDayOff(row.dayType)) {
    return "-";
  }
  return formatHm(row.rawEnd);
}

export function formatPreviewWork(row: WeekPreviewRow): string {
  if (isDayOff(row.dayType)) {
    return dayTypeLabel(row.dayType);
  }
  return workCellLabel(row.dayType, row.mainMinutes);
}
