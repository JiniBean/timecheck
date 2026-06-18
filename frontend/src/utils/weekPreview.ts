import type { DayType, WeekDay, WeekReport, Work } from "../types/dashboard";
import { readUserJson, writeUserJson } from "./clientStorage";
import { dayTypeLabel, isDayOff, workCellLabel } from "./dayType";
import { WEEK_TARGET_MIN, avgPerDay } from "./main";
import { mainMin } from "./ot";
import { formatDateTime, formatHm, fmtMinutes, hhmmToDateTime, parseDateTime } from "./time";
import {
  workMin,
  mergeToday,
  type CalcInput
} from "./timeCalculator";
import { WorkPolicy } from "./workPolicy";

export type PreviewRowKind = "actual" | "projected";

/** 과거 근무일 기록 누락 유형 */
export type MissingGap = "none" | "missing-checkout" | "missing-both";

export interface MissingDay {
  workDate: string;
  weekdayLabel: string;
  gap: Exclude<MissingGap, "none">;
}

export interface PrvOvrs {
  [workDate: string]: {
    rawStart?: string;
    rawEnd?: string;
  };
}

export interface PrvRow {
  workDate: string;
  weekdayLabel: string;
  dayType: DayType;
  rawStart: string | null;
  rawEnd: string | null;
  mainMinutes: number;
  kind: PreviewRowKind;
  isToday: boolean;
  canEditIn: boolean;
  canEditOut: boolean;
  isProjected: boolean;
  missingGap: MissingGap;
}

export interface PrvResult {
  rows: PrvRow[];
  weekMainMin: number;
  weekTargetMin: number;
  weekRemMin: number;
  weekOverMin: number;
  avgPerDayMin: number;
  incompletePastDays: MissingDay[];
}

export const PRV_START_MODE = {
  ON_TIME: "on-time",
  AVERAGE: "average",
  CUSTOM: "custom"
} as const;

export type PrvStartMode = (typeof PRV_START_MODE)[keyof typeof PRV_START_MODE];

export const PRV_START_PRESET = {
  ON_TIME: PRV_START_MODE.ON_TIME,
  AVERAGE: PRV_START_MODE.AVERAGE
} as const;

export type PrvStartPreset = (typeof PRV_START_PRESET)[keyof typeof PRV_START_PRESET];

export interface PrvPref {
  mode: PrvStartMode;
  hhmm?: string;
  lastPresetMode?: PrvStartPreset;
}

const PREF_SCOPE = "week-preview-start";
const HHMM_RE = /^\d{2}:\d{2}$/;
const PRV_START_MODES = Object.values(PRV_START_MODE);
const PRV_START_PRESETS = Object.values(PRV_START_PRESET);

function isPrvStartMode(value: unknown): value is PrvStartMode {
  return typeof value === "string" && (PRV_START_MODES as readonly string[]).includes(value);
}

function isPrvStartPreset(value: unknown): value is PrvStartPreset {
  return typeof value === "string" && (PRV_START_PRESETS as readonly string[]).includes(value);
}

function parsePref(raw: unknown): PrvPref | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const source = raw as Record<string, unknown>;
  if (!isPrvStartMode(source.mode)) {
    return null;
  }
  if (source.hhmm !== undefined && (typeof source.hhmm !== "string" || !HHMM_RE.test(source.hhmm))) {
    return null;
  }
  if (source.lastPresetMode !== undefined && !isPrvStartPreset(source.lastPresetMode)) {
    return null;
  }
  if (source.mode === PRV_START_MODE.CUSTOM && typeof source.hhmm !== "string") {
    return null;
  }
  return {
    mode: source.mode,
    hhmm: typeof source.hhmm === "string" ? source.hhmm : undefined,
    lastPresetMode: isPrvStartPreset(source.lastPresetMode) ? source.lastPresetMode : undefined
  };
}

export function loadPref(userId: number): PrvPref | null {
  return parsePref(readUserJson<unknown>(PREF_SCOPE, userId));
}

export function savePref(userId: number, pref: PrvPref): void {
  writeUserJson(PREF_SCOPE, userId, pref);
}

export function prvStartFromPref(
  pref: PrvPref | null,
  typicalInHhmm: string | null,
  onTimeHhmm: string
): { mode: PrvStartMode; hhmm: string; preset: PrvStartPreset } {
  const fallback = {
    mode: PRV_START_MODE.ON_TIME,
    hhmm: onTimeHhmm,
    preset: PRV_START_PRESET.ON_TIME
  };
  if (!pref) {
    return fallback;
  }

  const preset = pref.lastPresetMode ?? PRV_START_PRESET.ON_TIME;

  if (pref.mode === PRV_START_MODE.ON_TIME) {
    return { mode: PRV_START_MODE.ON_TIME, hhmm: onTimeHhmm, preset };
  }

  if (pref.mode === PRV_START_MODE.AVERAGE) {
    if (typicalInHhmm) {
      return { mode: PRV_START_MODE.AVERAGE, hhmm: typicalInHhmm, preset };
    }
    return fallback;
  }

  if (pref.hhmm) {
    return { mode: PRV_START_MODE.CUSTOM, hhmm: pref.hhmm, preset };
  }

  return fallback;
}

interface DayEditability {
  canEditIn: boolean;
  canEditOut: boolean;
  isFixed: boolean;
}

interface ResolvedDayTimes {
  rawStart: string | null;
  rawEnd: string | null;
  mainMinutes: number;
  isProjected: boolean;
  kind: PreviewRowKind;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

const DEFAULT_PRV_START_HHMM = "09:00";

function halfDayBoundary(workDate: string): string {
  return hhmmToDateTime(workDate, WorkPolicy.HALF_DAY_HHMM);
}

function defaultStart(workDate: string, dayType: DayType, prvStartHhmm: string): string {
  if (dayType === "AM") {
    return halfDayBoundary(workDate);
  }
  return hhmmToDateTime(workDate, prvStartHhmm || DEFAULT_PRV_START_HHMM);
}

function endAtMainMin(
  workDate: string,
  rawStart: Date,
  dayType: DayType,
  targetMainMinutes: number
): Date {
  const target = Math.max(0, targetMainMinutes);
  let cursor = addMinutes(rawStart, 30);
  const maxEnd = addMinutes(rawStart, 16 * 60);

  while (cursor.getTime() <= maxEnd.getTime()) {
    if (mainMin(workDate, rawStart, cursor, dayType) >= target) {
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
): CalcInput {
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
  return workMin(calcInput(workDate, dayType, rawStart, rawEnd)).main;
}

function missingGap(day: WeekDay, todayDate: string): MissingGap {
  if (day.workDate >= todayDate || isDayOff(day.dayType)) {
    return "none";
  }
  if (day.rawEnd) {
    return "none";
  }
  if (!day.rawStart) {
    return "missing-both";
  }
  return "missing-checkout";
}

function editPerms(
  day: WeekDay,
  todayDate: string,
  effectiveToday: Work
): DayEditability {
  if (isDayOff(day.dayType)) {
    return { canEditIn: false, canEditOut: false, isFixed: true };
  }

  const workDate = day.workDate;
  if (workDate < todayDate) {
    return { canEditIn: false, canEditOut: false, isFixed: true };
  }

  const rawStart = workDate === todayDate ? effectiveToday.rawStart : day.rawStart;
  const rawEnd = workDate === todayDate ? effectiveToday.rawEnd : day.rawEnd;

  if (rawEnd) {
    return { canEditIn: false, canEditOut: false, isFixed: true };
  }
  if (rawStart) {
    return { canEditIn: false, canEditOut: true, isFixed: false };
  }
  return { canEditIn: true, canEditOut: true, isFixed: false };
}

function actualTimes(
  day: WeekDay,
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
  day: WeekDay;
  edit: DayEditability;
  start: string;
  dayType: DayType;
  isToday: boolean;
  hasRecordedStart: boolean;
  lockedEnd: string | null;
}

export function buildPrv(input: {
  weeklyReport: WeekReport;
  todayWork: Work;
  todayDateKey: string;
  overrides?: PrvOvrs;
  prvStartHhmm?: string;
  asOf?: Date;
}): PrvResult {
  const { weeklyReport, todayWork, todayDateKey } = input;
  const overrides = input.overrides ?? {};
  const prvStartHhmm = input.prvStartHhmm ?? DEFAULT_PRV_START_HHMM;
  const asOf = input.asOf ?? new Date();
  const effectiveToday = mergeToday(todayWork, weeklyReport.days, todayDateKey);
  const targetMinutes = weeklyReport.summary.targetMinutes || WEEK_TARGET_MIN;

  let fixedMinutes = 0;
  const autoSlots: AutoDaySlot[] = [];
  const resolved = new Map<string, ResolvedDayTimes>();

  for (const day of weeklyReport.days) {
    const edit = editPerms(day, todayDateKey, effectiveToday);
    const override = overrides[day.workDate];

    if (edit.isFixed) {
      const actual = actualTimes(day, todayDateKey, effectiveToday);
      const gap = missingGap(day, todayDateKey);
      const mainMinutes = gap !== "none" ? 0 : actual.mainMinutes;
      resolved.set(day.workDate, {
        ...actual,
        mainMinutes
      });
      fixedMinutes += mainMinutes;
      continue;
    }

    if (isDayOff(day.dayType)) {
      const actual = actualTimes(day, todayDateKey, effectiveToday);
      resolved.set(day.workDate, actual);
      fixedMinutes += WorkPolicy.STD_WORK;
      continue;
    }

    const isToday = day.workDate === todayDateKey;
    const baseStart = isToday ? effectiveToday.rawStart : day.rawStart;
    const dayType = isToday ? effectiveToday.dayType : day.dayType;
    const isOt = isToday ? effectiveToday.isOt : day.isOt;
    const hasRecordedStart = Boolean(baseStart);

    const fallbackStart = dayType === "AM"
      ? halfDayBoundary(day.workDate)
      : (baseStart ?? defaultStart(day.workDate, dayType, prvStartHhmm));
    const start = override?.rawStart ?? fallbackStart;
    const lockedEnd = override?.rawEnd ?? (dayType === "PM" ? halfDayBoundary(day.workDate) : null);

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

    if (isOt && !override?.rawEnd) {
      const startDt = parseDateTime(start);
      const endDt = startDt ? endAtMainMin(day.workDate, startDt, dayType, WorkPolicy.STD_WORK) : null;
      const rawEnd = endDt ? formatDateTime(day.workDate, endDt) : null;
      fixedMinutes += WorkPolicy.STD_WORK;
      resolved.set(day.workDate, {
        rawStart: start,
        rawEnd,
        mainMinutes: WorkPolicy.STD_WORK,
        isProjected: true,
        kind: "projected"
      });
      continue;
    }

    autoSlots.push({
      day,
      edit,
      start,
      dayType,
      isToday,
      hasRecordedStart,
      lockedEnd: null
    });
  }

  // 어제까지 확정 실적 + 오늘 퇴근 저장분만 반영하고, 오늘 진행 중 분은 제외한 뒤 남은 일에 분배
  const weekRemaining = Math.max(0, targetMinutes - fixedMinutes);
  const initialPerDayMinutes = autoSlots.length > 0 ? avgPerDay(weekRemaining, autoSlots.length) : 0;
  const todayIdx = autoSlots.findIndex((slot) => slot.isToday && slot.hasRecordedStart);

  let todayAssignedMinutes: number | null = null;
  let todayForcedEnd: Date | null = null;

  if (todayIdx >= 0) {
    const todaySlot = autoSlots[todayIdx];
    const startDt = parseDateTime(todaySlot.start);
    if (startDt) {
      const scheduledEnd = endAtMainMin(
        todaySlot.day.workDate,
        startDt,
        todaySlot.dayType,
        initialPerDayMinutes
      );
      const scheduledMinutes = mainMin(todaySlot.day.workDate, startDt, scheduledEnd, todaySlot.dayType);
      if (asOf.getTime() > scheduledEnd.getTime()) {
        const liveMinutes = mainMin(todaySlot.day.workDate, startDt, asOf, todaySlot.dayType);
        todayAssignedMinutes = Math.max(scheduledMinutes, liveMinutes);
        todayForcedEnd = asOf;
      } else {
        todayAssignedMinutes = scheduledMinutes;
      }
    }
  }

  const futureSlotCount = Math.max(0, autoSlots.length - (todayAssignedMinutes !== null ? 1 : 0));
  const futureRemainingMinutes = Math.max(0, weekRemaining - Math.max(0, todayAssignedMinutes ?? 0));
  const futurePerDayMinutes = futureSlotCount > 0 ? avgPerDay(futureRemainingMinutes, futureSlotCount) : 0;

  for (const slot of autoSlots) {
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

    const targetMainMinutes =
      slot.isToday && todayAssignedMinutes !== null
        ? todayAssignedMinutes
        : futurePerDayMinutes;
    const endDt =
      slot.isToday && todayForcedEnd
        ? todayForcedEnd
        : endAtMainMin(slot.day.workDate, startDt, slot.dayType, targetMainMinutes);
    const rawEnd = formatDateTime(slot.day.workDate, endDt);
    const mainMinutes = mainMin(slot.day.workDate, startDt, endDt, slot.dayType);

    resolved.set(slot.day.workDate, {
      rawStart: slot.start,
      rawEnd,
      mainMinutes,
      isProjected: true,
      kind: "projected"
    });
  }

  const incompletePastDays: MissingDay[] = [];

  const rows: PrvRow[] = weeklyReport.days.map((day) => {
    const edit = editPerms(day, todayDateKey, effectiveToday);
    const times = resolved.get(day.workDate)!;
    const isToday = day.workDate === todayDateKey;
    const dayType = isToday ? effectiveToday.dayType : day.dayType;
    const gap = missingGap(day, todayDateKey);

    if (gap !== "none") {
      incompletePastDays.push({
        workDate: day.workDate,
        weekdayLabel: day.weekdayLabel,
        gap
      });
    }

    return {
      workDate: day.workDate,
      weekdayLabel: day.weekdayLabel,
      dayType,
      rawStart: times.rawStart,
      rawEnd: times.rawEnd,
      mainMinutes: times.mainMinutes,
      kind: times.kind,
      isToday,
      canEditIn: edit.canEditIn,
      canEditOut: edit.canEditOut,
      isProjected: times.isProjected,
      missingGap: gap
    };
  });

  const weekMainMin = rows.reduce((sum, row) => sum + row.mainMinutes, 0);
  const weekRemMin = Math.max(0, targetMinutes - weekMainMin);
  const weekOverMin = Math.max(0, weekMainMin - targetMinutes);
  const avgPerDayMin = futurePerDayMinutes;

  return {
    rows,
    weekMainMin,
    weekTargetMin: targetMinutes,
    weekRemMin,
    weekOverMin,
    avgPerDayMin,
    incompletePastDays
  };
}

export function missingSummary(days: MissingDay[]): string {
  if (days.length === 0) {
    return "";
  }
  const labels = days.map((day) => {
    const detail = day.gap === "missing-checkout" ? "퇴근 미완료" : "출퇴근 미기록";
    return `${day.weekdayLabel} · ${detail}`;
  });
  return `${labels.join(", ")} — 일반 근무표에서 입력해 주세요`;
}

export function isNextDay(row: PrvRow): boolean {
  if (isDayOff(row.dayType) || row.missingGap !== "none" || !row.rawStart || !row.rawEnd) {
    return false;
  }
  const start = parseDateTime(row.rawStart);
  const end = parseDateTime(row.rawEnd);
  if (!start || !end) {
    return false;
  }
  return end.getTime() <= start.getTime() || end.getHours() < 6;
}

export function fmtIn(row: PrvRow): string {
  if (isDayOff(row.dayType)) {
    return "-";
  }
  if (row.missingGap === "missing-both") {
    return "-";
  }
  return formatHm(row.rawStart);
}

export function fmtOut(row: PrvRow): string {
  if (isDayOff(row.dayType)) {
    return "-";
  }
  if (row.missingGap === "missing-checkout") {
    return "-";
  }
  if (row.missingGap === "missing-both") {
    return "-";
  }
  const formatted = formatHm(row.rawEnd);
  if (formatted === "-") {
    return "-";
  }
  return formatted;
}

export function fmtWork(row: PrvRow): string {
  if (isDayOff(row.dayType)) {
    return dayTypeLabel(row.dayType);
  }
  if (row.missingGap !== "none") {
    return fmtMinutes(0);
  }
  return workCellLabel(row.dayType, row.mainMinutes);
}
