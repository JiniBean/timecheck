import type { DayType, WeekDay, WeekReport, Work } from "../types/dashboard";
import { readUserJson, writeUserJson } from "./clientStorage";
import { isDayOff, mainMinutesLabel } from "./dayType";
import { localDateKey } from "./localDate";
import { WEEK_TARGET_MIN, avgPerDay } from "./main";
import { mainMin, truncateToMinute } from "./ot";
import { formatDateTime, formatHm, fmtMinutes, hhmmToDateTime, parseDateTime } from "./time";
import {
  workMin,
  mergeToday,
  weekDayCtx,
  type CalcInput,
  type WeekDayCtx
} from "./timeCalculator";
import { WorkPolicy } from "./workPolicy";

export type PrvRowKind = "fix" | "prv";

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
  workMin: number;
  kind: PrvRowKind;
  isToday: boolean;
  canEditIn: boolean;
  canEditOut: boolean;
  missingGap: MissingGap;
}

export interface PrvResult {
  rows: PrvRow[];
  weekWorkedMin: number;
  weekTargetMin: number;
  weekRemMin: number;
  weekOverMin: number;
  avgPerDayMin: number;
  missingDays: MissingDay[];
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

interface FixSlot {
  rawStart: string | null;
  rawEnd: string | null;
  workMin: number;
  kind: PrvRowKind;
}

interface PrvSlot {
  day: WeekDay;
  ctx: WeekDayCtx;
  rawStart: string;
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

function endForWorkMin(
  workDate: string,
  rawStart: Date,
  dayType: DayType,
  targetWorkMin: number
): Date {
  const target = Math.max(0, targetWorkMin);
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

function workMinFromStartEnd(
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

function editPerms(day: WeekDay, todayDateKey: string, ctx: WeekDayCtx): DayEditability {
  if (ctx.isOff) {
    return { canEditIn: false, canEditOut: false, isFixed: true };
  }

  if (day.workDate < todayDateKey) {
    return { canEditIn: false, canEditOut: false, isFixed: true };
  }

  if (ctx.rawEnd) {
    return { canEditIn: false, canEditOut: false, isFixed: true };
  }
  if (ctx.rawStart) {
    return { canEditIn: false, canEditOut: true, isFixed: false };
  }
  return { canEditIn: true, canEditOut: true, isFixed: false };
}

function fixTimes(day: WeekDay, ctx: WeekDayCtx): FixSlot {
  if (ctx.isOff) {
    return {
      rawStart: null,
      rawEnd: null,
      workMin: WorkPolicy.STD_WORK,
      kind: "fix"
    };
  }

  const workMinValue = workMinFromStartEnd(
    day.workDate,
    ctx.dayType,
    ctx.rawStart,
    ctx.rawEnd,
    day.main
  );

  return {
    rawStart: ctx.rawStart,
    rawEnd: ctx.rawEnd,
    workMin: workMinValue,
    kind: "fix"
  };
}

function bumpStartIfLate(
  workDate: string,
  start: string,
  ctx: WeekDayCtx,
  asOf: Date,
  hasOverride: boolean
): string {
  if (!ctx.isToday || ctx.rawStart || hasOverride) {
    return start;
  }
  const planned = parseDateTime(start);
  const now = truncateToMinute(asOf);
  if (planned && now.getTime() > planned.getTime()) {
    return formatDateTime(workDate, now);
  }
  return start;
}

function collectPrv(input: {
  days: WeekDay[];
  mergedToday: Work;
  todayDateKey: string;
  overrides: PrvOvrs;
  prvStartHhmm: string;
  asOf: Date;
}): {
  workedMin: number;
  fixSlots: Map<string, FixSlot>;
  prvSlots: PrvSlot[];
} {
  const { days, mergedToday, todayDateKey, overrides, prvStartHhmm, asOf } = input;
  let workedMin = 0;
  const prvSlots: PrvSlot[] = [];
  const fixSlots = new Map<string, FixSlot>();

  for (const day of days) {
    const ctx = weekDayCtx(day, todayDateKey, mergedToday);
    const edit = editPerms(day, todayDateKey, ctx);
    const override = overrides[day.workDate];

    if (edit.isFixed) {
      const actual = fixTimes(day, ctx);
      const gap = missingGap(day, todayDateKey);
      const workMinValue = gap !== "none" ? 0 : actual.workMin;
      fixSlots.set(day.workDate, {
        ...actual,
        workMin: workMinValue
      });
      workedMin += workMinValue;
      continue;
    }

    if (ctx.isOff) {
      const actual = fixTimes(day, ctx);
      fixSlots.set(day.workDate, actual);
      workedMin += WorkPolicy.STD_WORK;
      continue;
    }

    const fallbackStart = ctx.dayType === "AM"
      ? halfDayBoundary(day.workDate)
      : (ctx.rawStart ?? defaultStart(day.workDate, ctx.dayType, prvStartHhmm));
    let rawStart = override?.rawStart ?? fallbackStart;
    rawStart = bumpStartIfLate(day.workDate, rawStart, ctx, asOf, Boolean(override?.rawStart));

    const lockedEnd = override?.rawEnd ?? (ctx.dayType === "PM" ? halfDayBoundary(day.workDate) : null);

    if (lockedEnd) {
      const workMinValue = workMinFromStartEnd(day.workDate, ctx.dayType, rawStart, lockedEnd);
      workedMin += workMinValue;
      fixSlots.set(day.workDate, {
        rawStart,
        rawEnd: lockedEnd,
        workMin: workMinValue,
        kind: "prv"
      });
      continue;
    }

    if (ctx.isOt && !override?.rawEnd) {
      const startDt = parseDateTime(rawStart);
      const endDt = startDt ? endForWorkMin(day.workDate, startDt, ctx.dayType, WorkPolicy.STD_WORK) : null;
      const rawEnd = endDt ? formatDateTime(localDateKey(endDt), endDt) : null;
      workedMin += WorkPolicy.STD_WORK;
      fixSlots.set(day.workDate, {
        rawStart,
        rawEnd,
        workMin: WorkPolicy.STD_WORK,
        kind: "prv"
      });
      continue;
    }

    prvSlots.push({ day, ctx, rawStart });
  }

  return { workedMin, fixSlots, prvSlots };
}

function fillPrvSlots(input: {
  prvSlots: PrvSlot[];
  leftMin: number;
  perDayMin: number;
  asOf: Date;
  fixSlots: Map<string, FixSlot>;
}): number {
  const { prvSlots, leftMin, perDayMin, asOf, fixSlots } = input;
  const todayIdx = prvSlots.findIndex((slot) => slot.ctx.isWorking);

  let todayMin: number | null = null;
  let todayLiveEnd: Date | null = null;

  if (todayIdx >= 0) {
    const todaySlot = prvSlots[todayIdx];
    const startDt = parseDateTime(todaySlot.rawStart);
    if (startDt) {
      const end = endForWorkMin(
        todaySlot.day.workDate,
        startDt,
        todaySlot.ctx.dayType,
        perDayMin
      );
      const splitWorkMin = mainMin(todaySlot.day.workDate, startDt, end, todaySlot.ctx.dayType);
      if (asOf.getTime() > end.getTime()) {
        const liveWorkMin = mainMin(todaySlot.day.workDate, startDt, asOf, todaySlot.ctx.dayType);
        todayMin = Math.max(splitWorkMin, liveWorkMin);
        todayLiveEnd = asOf;
      } else {
        todayMin = splitWorkMin;
      }
    }
  }

  const restSlotCount = Math.max(0, prvSlots.length - (todayMin !== null ? 1 : 0));
  const restLeftMin = Math.max(0, leftMin - Math.max(0, todayMin ?? 0));
  const restPerDayMin = restSlotCount > 0 ? avgPerDay(restLeftMin, restSlotCount) : 0;

  for (const slot of prvSlots) {
    const startDt = parseDateTime(slot.rawStart);
    if (!startDt) {
      fixSlots.set(slot.day.workDate, {
        rawStart: slot.rawStart,
        rawEnd: null,
        workMin: 0,
        kind: "prv"
      });
      continue;
    }

    const targetWorkMin =
      slot.ctx.isToday && todayMin !== null
        ? todayMin
        : restPerDayMin;
    const endDt =
      slot.ctx.isToday && todayLiveEnd
        ? todayLiveEnd
        : endForWorkMin(slot.day.workDate, startDt, slot.ctx.dayType, targetWorkMin);
    const rawEnd = formatDateTime(localDateKey(endDt), endDt);
    const workMinValue = mainMin(slot.day.workDate, startDt, endDt, slot.ctx.dayType);

    fixSlots.set(slot.day.workDate, {
      rawStart: slot.rawStart,
      rawEnd,
      workMin: workMinValue,
      kind: "prv"
    });
  }

  return restPerDayMin;
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
  const mergedToday = mergeToday(todayWork, weeklyReport.days, todayDateKey);
  const weekTargetMin = weeklyReport.summary.baseMin || WEEK_TARGET_MIN;

  const { workedMin, fixSlots, prvSlots } = collectPrv({
    days: weeklyReport.days,
    mergedToday,
    todayDateKey,
    overrides,
    prvStartHhmm,
    asOf
  });

  const leftMin = Math.max(0, weekTargetMin - workedMin);
  const perDayMin = prvSlots.length > 0 ? avgPerDay(leftMin, prvSlots.length) : 0;
  const restPerDayMin = fillPrvSlots({
    prvSlots,
    leftMin,
    perDayMin,
    asOf,
    fixSlots
  });

  const missingDays: MissingDay[] = [];

  const rows: PrvRow[] = weeklyReport.days.map((day) => {
    const ctx = weekDayCtx(day, todayDateKey, mergedToday);
    const edit = editPerms(day, todayDateKey, ctx);
    const times = fixSlots.get(day.workDate)!;
    const gap = missingGap(day, todayDateKey);

    if (gap !== "none") {
      missingDays.push({
        workDate: day.workDate,
        weekdayLabel: day.weekdayLabel,
        gap
      });
    }

    return {
      workDate: day.workDate,
      weekdayLabel: day.weekdayLabel,
      dayType: ctx.dayType,
      rawStart: times.rawStart,
      rawEnd: times.rawEnd,
      workMin: times.workMin,
      kind: times.kind,
      isToday: ctx.isToday,
      canEditIn: edit.canEditIn,
      canEditOut: edit.canEditOut,
      missingGap: gap
    };
  });

  const weekWorkedMin = rows.reduce((sum, row) => sum + row.workMin, 0);
  const weekRemMin = Math.max(0, weekTargetMin - weekWorkedMin);
  const weekOverMin = Math.max(0, weekWorkedMin - weekTargetMin);

  return {
    rows,
    weekWorkedMin,
    weekTargetMin,
    weekRemMin,
    weekOverMin,
    avgPerDayMin: restPerDayMin,
    missingDays
  };
}

export function toPrvRecords(
  rows: PrvRow[]
): Array<Pick<Work, "workDate" | "rawStart" | "rawEnd">> {
  const records: Array<Pick<Work, "workDate" | "rawStart" | "rawEnd">> = [];
  for (const row of rows) {
    if (
      row.missingGap !== "none" ||
      isDayOff(row.dayType) ||
      (!row.canEditIn && !row.canEditOut) ||
      !row.rawStart ||
      !row.rawEnd
    ) {
      continue;
    }

    let rawEnd = row.rawEnd;
    if (rawEnd.slice(0, 10) === row.workDate && isNextDay(row)) {
      const end = parseDateTime(rawEnd);
      if (end) {
        end.setDate(end.getDate() + 1);
        rawEnd = formatDateTime(localDateKey(end), end);
      }
    }
    records.push({
      workDate: row.workDate,
      rawStart: row.rawStart,
      rawEnd
    });
  }
  return records;
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
  if (row.missingGap !== "none") {
    return fmtMinutes(0);
  }
  return mainMinutesLabel(row.workMin);
}
