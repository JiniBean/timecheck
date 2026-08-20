import type { DayType, WeekDay, WeekReport, Work } from "../types/dashboard";
import { readUserJson, writeUserJson } from "./clientStorage";
import { isDayOff, formatMainMin } from "./dayType";
import { localDateKey } from "./localDate";
import { WEEK_TARGET_MIN, avgPerDay } from "./main";
import { mainMin, otPreview, truncateToMinute } from "./ot";
import { formatDateTime, formatHm, formatMinutes, hhmmToDateTime, parseDateTime } from "./time";
import { mergeToday, weekDayCtx, type WeekDayCtx } from "./timeCalculator";
import { WorkPolicy } from "./workPolicy";

export type PreviewRowKind = "fix" | "prv";

/** 과거 근무일 기록 누락 유형 */
export type MissingGap = "none" | "missing-checkout" | "missing-both";

export interface MissingDay {
  workDate: string;
  weekdayLabel: string;
  gap: Exclude<MissingGap, "none">;
}

export interface PreviewOverrides {
  [workDate: string]: {
    rawStart?: string;
    mainEnd?: string;
  };
}

export interface PreviewRow {
  workDate: string;
  weekdayLabel: string;
  dayLabel: string;
  dayType: DayType;
  rawStart: string | null;
  mainEnd: string | null;
  workMin: number;
  kind: PreviewRowKind;
  isToday: boolean;
  canEditIn: boolean;
  canEditOut: boolean;
  missingGap: MissingGap;
}

export interface PreviewResult {
  rows: PreviewRow[];
  weekWorkedMin: number;
  weekTargetMin: number;
  weekRemMin: number;
  weekOverMin: number;
  avgPerDayMin: number;
  missingDays: MissingDay[];
}

export const PREVIEW_START_MODE = {
  ON_TIME: "on-time",
  AVERAGE: "average",
  CUSTOM: "custom"
} as const;

export type PreviewStartMode = (typeof PREVIEW_START_MODE)[keyof typeof PREVIEW_START_MODE];

export const PREVIEW_START_PRESET = {
  ON_TIME: PREVIEW_START_MODE.ON_TIME,
  AVERAGE: PREVIEW_START_MODE.AVERAGE
} as const;

export type PreviewStartPreset = (typeof PREVIEW_START_PRESET)[keyof typeof PREVIEW_START_PRESET];

export interface PreviewPref {
  mode: PreviewStartMode;
  hhmm?: string;
  lastPresetMode?: PreviewStartPreset;
}

const PREF_SCOPE = "week-preview-start";
const HHMM_RE = /^\d{2}:\d{2}$/;
const PREVIEW_START_MODES = Object.values(PREVIEW_START_MODE);
const PREVIEW_START_PRESETS = Object.values(PREVIEW_START_PRESET);

function isPreviewStartMode(value: unknown): value is PreviewStartMode {
  return typeof value === "string" && (PREVIEW_START_MODES as readonly string[]).includes(value);
}

function isPreviewStartPreset(value: unknown): value is PreviewStartPreset {
  return typeof value === "string" && (PREVIEW_START_PRESETS as readonly string[]).includes(value);
}

function parsePref(raw: unknown): PreviewPref | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const source = raw as Record<string, unknown>;
  if (!isPreviewStartMode(source.mode)) {
    return null;
  }
  if (source.hhmm !== undefined && (typeof source.hhmm !== "string" || !HHMM_RE.test(source.hhmm))) {
    return null;
  }
  if (source.lastPresetMode !== undefined && !isPreviewStartPreset(source.lastPresetMode)) {
    return null;
  }
  if (source.mode === PREVIEW_START_MODE.CUSTOM && typeof source.hhmm !== "string") {
    return null;
  }
  return {
    mode: source.mode,
    hhmm: typeof source.hhmm === "string" ? source.hhmm : undefined,
    lastPresetMode: isPreviewStartPreset(source.lastPresetMode) ? source.lastPresetMode : undefined
  };
}

export function loadPref(userId: number): PreviewPref | null {
  return parsePref(readUserJson<unknown>(PREF_SCOPE, userId));
}

export function savePref(userId: number, pref: PreviewPref): void {
  writeUserJson(PREF_SCOPE, userId, pref);
}

export function previewStartFromPref(
  pref: PreviewPref | null,
  typicalInHhmm: string | null,
  onTimeHhmm: string
): { mode: PreviewStartMode; hhmm: string; preset: PreviewStartPreset } {
  const fallback = {
    mode: PREVIEW_START_MODE.ON_TIME,
    hhmm: onTimeHhmm,
    preset: PREVIEW_START_PRESET.ON_TIME
  };
  if (!pref) {
    return fallback;
  }

  const preset = pref.lastPresetMode ?? PREVIEW_START_PRESET.ON_TIME;

  if (pref.mode === PREVIEW_START_MODE.ON_TIME) {
    return { mode: PREVIEW_START_MODE.ON_TIME, hhmm: onTimeHhmm, preset };
  }

  if (pref.mode === PREVIEW_START_MODE.AVERAGE) {
    if (typicalInHhmm) {
      return { mode: PREVIEW_START_MODE.AVERAGE, hhmm: typicalInHhmm, preset };
    }
    return fallback;
  }

  if (pref.hhmm) {
    return { mode: PREVIEW_START_MODE.CUSTOM, hhmm: pref.hhmm, preset };
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
  mainEnd: string | null;
  workMin: number;
  kind: PreviewRowKind;
}

interface PreviewSlot {
  day: WeekDay;
  ctx: WeekDayCtx;
  rawStart: string;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

const DEFAULT_PREVIEW_START_HHMM = "09:00";

function halfDayBoundary(workDate: string): string {
  return hhmmToDateTime(workDate, WorkPolicy.HALF_DAY_HHMM);
}

function defaultStart(workDate: string, dayType: DayType, previewStartHhmm: string): string {
  if (dayType === "AM") {
    return halfDayBoundary(workDate);
  }
  return hhmmToDateTime(workDate, previewStartHhmm || DEFAULT_PREVIEW_START_HHMM);
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

/** 일반근무 시작~종료 사이 인정 근무 분 (투영 행 계산용) */
function mainMinBetween(
  workDate: string,
  dayType: DayType,
  mainStart: string | null,
  mainEnd: string | null
): number {
  const start = parseDateTime(mainStart);
  const end = parseDateTime(mainEnd);
  if (!start || !end) {
    return 0;
  }
  return mainMin(workDate, start, end, dayType);
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

/** 확정 행: 일반근무 종료·근무 분을 대시보드 계산값 그대로 사용 */
function fixTimes(ctx: WeekDayCtx): FixSlot {
  if (ctx.isOff) {
    return {
      rawStart: null,
      mainEnd: null,
      workMin: WorkPolicy.STD_WORK,
      kind: "fix"
    };
  }

  return {
    rawStart: ctx.rawStart,
    mainEnd: ctx.mainEnd,
    workMin: ctx.mainMin,
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

function collectPreview(input: {
  days: WeekDay[];
  mergedToday: Work;
  todayDateKey: string;
  overrides: PreviewOverrides;
  previewStartHhmm: string;
  asOf: Date;
}): {
  workedMin: number;
  fixSlots: Map<string, FixSlot>;
  previewSlots: PreviewSlot[];
} {
  const { days, mergedToday, todayDateKey, overrides, previewStartHhmm, asOf } = input;
  let workedMin = 0;
  const previewSlots: PreviewSlot[] = [];
  const fixSlots = new Map<string, FixSlot>();

  for (const day of days) {
    const ctx = weekDayCtx(day, todayDateKey, mergedToday);
    const edit = editPerms(day, todayDateKey, ctx);
    const override = overrides[day.workDate];

    if (edit.isFixed) {
      const actual = fixTimes(ctx);
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
      fixSlots.set(day.workDate, fixTimes(ctx));
      workedMin += WorkPolicy.STD_WORK;
      continue;
    }

    const fallbackStart = ctx.dayType === "AM"
      ? halfDayBoundary(day.workDate)
      : (ctx.rawStart ?? defaultStart(day.workDate, ctx.dayType, previewStartHhmm));
    let rawStart = override?.rawStart ?? fallbackStart;
    rawStart = bumpStartIfLate(day.workDate, rawStart, ctx, asOf, Boolean(override?.rawStart));

    const lockedEnd = override?.mainEnd ?? (ctx.dayType === "PM" ? halfDayBoundary(day.workDate) : null);

    if (lockedEnd) {
      const workMinValue = mainMinBetween(day.workDate, ctx.dayType, rawStart, lockedEnd);
      workedMin += workMinValue;
      fixSlots.set(day.workDate, {
        rawStart,
        mainEnd: lockedEnd,
        workMin: workMinValue,
        kind: "prv"
      });
      continue;
    }

    if (ctx.isOt) {
      // 펀치카드·일반 근무표와 동일한 투영을 쓰기 위해 otPreview를 그대로 사용
      const storedMainEnd = rawStart === ctx.rawStart ? ctx.mainEnd : null;
      const projected = otPreview(
        {
          workDate: day.workDate,
          rawStart,
          rawEnd: null,
          dayType: ctx.dayType,
          isOt: true,
          mainEnd: storedMainEnd,
          otStart: null,
          otEnd: null
        },
        asOf
      );
      const workMinValue = mainMinBetween(day.workDate, ctx.dayType, rawStart, projected.mainEnd);
      workedMin += workMinValue;
      fixSlots.set(day.workDate, {
        rawStart,
        mainEnd: projected.mainEnd,
        workMin: workMinValue,
        kind: "prv"
      });
      continue;
    }

    previewSlots.push({ day, ctx, rawStart });
  }

  return { workedMin, fixSlots, previewSlots };
}

function fillPreviewSlots(input: {
  previewSlots: PreviewSlot[];
  leftMin: number;
  perDayMin: number;
  asOf: Date;
  fixSlots: Map<string, FixSlot>;
}): number {
  const { previewSlots, leftMin, perDayMin, asOf, fixSlots } = input;
  const todayIdx = previewSlots.findIndex((slot) => slot.ctx.isWorking);

  let todayMin: number | null = null;
  let todayLiveEnd: Date | null = null;

  if (todayIdx >= 0) {
    const todaySlot = previewSlots[todayIdx];
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

  const restSlotCount = Math.max(0, previewSlots.length - (todayMin !== null ? 1 : 0));
  const restLeftMin = Math.max(0, leftMin - Math.max(0, todayMin ?? 0));
  const restPerDayMin = restSlotCount > 0 ? avgPerDay(restLeftMin, restSlotCount) : 0;

  for (const slot of previewSlots) {
    const startDt = parseDateTime(slot.rawStart);
    if (!startDt) {
      fixSlots.set(slot.day.workDate, {
        rawStart: slot.rawStart,
        mainEnd: null,
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
    const mainEnd = formatDateTime(localDateKey(endDt), endDt);
    const workMinValue = mainMin(slot.day.workDate, startDt, endDt, slot.ctx.dayType);

    fixSlots.set(slot.day.workDate, {
      rawStart: slot.rawStart,
      mainEnd,
      workMin: workMinValue,
      kind: "prv"
    });
  }

  return restPerDayMin;
}

export function buildPreview(input: {
  weeklyReport: WeekReport;
  todayWork: Work;
  todayDateKey: string;
  overrides?: PreviewOverrides;
  previewStartHhmm?: string;
  asOf?: Date;
}): PreviewResult {
  const { weeklyReport, todayWork, todayDateKey } = input;
  const overrides = input.overrides ?? {};
  const previewStartHhmm = input.previewStartHhmm ?? DEFAULT_PREVIEW_START_HHMM;
  const asOf = input.asOf ?? new Date();
  const mergedToday = mergeToday(todayWork, weeklyReport.days, todayDateKey);
  const weekTargetMin = weeklyReport.summary.baseMin || WEEK_TARGET_MIN;

  const { workedMin, fixSlots, previewSlots } = collectPreview({
    days: weeklyReport.days,
    mergedToday,
    todayDateKey,
    overrides,
    previewStartHhmm,
    asOf
  });

  const leftMin = Math.max(0, weekTargetMin - workedMin);
  const perDayMin = previewSlots.length > 0 ? avgPerDay(leftMin, previewSlots.length) : 0;
  const restPerDayMin = fillPreviewSlots({
    previewSlots,
    leftMin,
    perDayMin,
    asOf,
    fixSlots
  });

  const missingDays: MissingDay[] = [];

  const rows: PreviewRow[] = weeklyReport.days.map((day) => {
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
      dayLabel: day.dayLabel,
      dayType: ctx.dayType,
      rawStart: times.rawStart,
      mainEnd: times.mainEnd,
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

/** 적용 요청 레코드. 일반근무 종료를 mainEnd로 보내고, rawEnd는 같은 값을 API 계약용으로 함께 전송합니다. */
export function toPreviewRecords(
  rows: PreviewRow[]
): Array<Pick<Work, "workDate" | "rawStart" | "rawEnd" | "mainEnd">> {
  const records: Array<Pick<Work, "workDate" | "rawStart" | "rawEnd" | "mainEnd">> = [];
  for (const row of rows) {
    if (
      row.missingGap !== "none" ||
      isDayOff(row.dayType) ||
      (!row.canEditIn && !row.canEditOut) ||
      !row.rawStart ||
      !row.mainEnd
    ) {
      continue;
    }

    let mainEnd = row.mainEnd;
    if (mainEnd.slice(0, 10) === row.workDate && isNextDay(row)) {
      const end = parseDateTime(mainEnd);
      if (end) {
        end.setDate(end.getDate() + 1);
        mainEnd = formatDateTime(localDateKey(end), end);
      }
    }
    records.push({
      workDate: row.workDate,
      rawStart: row.rawStart,
      rawEnd: mainEnd,
      mainEnd
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

export function isNextDay(row: PreviewRow): boolean {
  if (isDayOff(row.dayType) || row.missingGap !== "none" || !row.rawStart || !row.mainEnd) {
    return false;
  }
  const start = parseDateTime(row.rawStart);
  const end = parseDateTime(row.mainEnd);
  if (!start || !end) {
    return false;
  }
  return end.getTime() <= start.getTime() || end.getHours() < 6;
}

export function formatIn(row: PreviewRow): string {
  if (isDayOff(row.dayType)) {
    return "-";
  }
  if (row.missingGap === "missing-both") {
    return "-";
  }
  return formatHm(row.rawStart);
}

export function formatOut(row: PreviewRow): string {
  if (isDayOff(row.dayType)) {
    return "-";
  }
  if (row.missingGap === "missing-checkout") {
    return "-";
  }
  if (row.missingGap === "missing-both") {
    return "-";
  }
  const formatted = formatHm(row.mainEnd);
  if (formatted === "-") {
    return "-";
  }
  return formatted;
}

export function formatWork(row: PreviewRow): string {
  if (row.missingGap !== "none") {
    return formatMinutes(0);
  }
  return formatMainMin(row.workMin);
}
