import type { DayType, WeeklyDayRow, WeeklyReport, Work } from "../types/dashboard";
import { formatHm } from "./time";
import { WorkPolicy } from "./workPolicy";

// --- Recalc ---

export type OtRecalcTrigger =
  | "auto"
  | "raw_start"
  | "raw_end"
  | "checkout_repeat"
  | "main_end"
  | "ot_start"
  | "ot_end";

export interface OtAnchorPatch {
  mainEnd?: string | null;
  otStart?: string | null;
  otEnd?: string | null;
  clearMainEnd?: boolean;
  clearOtStart?: boolean;
  clearOtEnd?: boolean;
}

/** 야근 앵커(mainEnd·otStart·otEnd)를 트리거에 맞게 갱신합니다. */
export function recalcOtAnchors(
  work: Pick<
    Work,
    "workDate" | "rawStart" | "rawEnd" | "dayType" | "isOt" | "mainEnd" | "otStart" | "otEnd"
  >,
  trigger: OtRecalcTrigger,
  patch?: OtAnchorPatch
): OtAnchorPatch {
  if (!work.isOt) {
    return {
      clearMainEnd: true,
      clearOtStart: true,
      clearOtEnd: true
    };
  }

  const rawStart = parseDateTime(work.rawStart);
  const rawEnd = parseDateTime(work.rawEnd);
  if (!rawStart || !rawEnd) {
    return {};
  }

  const workDate = work.workDate;
  const truncatedEnd = truncateToTenMinutes(rawEnd);

  switch (trigger) {
    case "checkout_repeat":
      return {
        mainEnd: work.mainEnd ?? undefined,
        otStart: work.otStart ?? undefined,
        otEnd: formatDateTime(workDate, truncatedEnd)
      };
    case "ot_end": {
      const otEnd = parseDateTime(patch?.otEnd ?? work.otEnd) ?? truncatedEnd;
      return {
        mainEnd: work.mainEnd ?? undefined,
        otStart: work.otStart ?? undefined,
        otEnd: formatDateTime(workDate, truncateToTenMinutes(otEnd))
      };
    }
    case "main_end": {
      const mainEnd = enforceMainEnd(
        workDate,
        parseDateTime(patch?.mainEnd ?? work.mainEnd) ?? coreEndAt(workDate)
      );
      const otStart = addMinutes(mainEnd, WorkPolicy.REST_EXTRA);
      return {
        mainEnd: formatDateTime(workDate, mainEnd),
        otStart: formatDateTime(workDate, otStart),
        otEnd: formatDateTime(workDate, truncatedEnd)
      };
    }
    case "ot_start": {
      const otStart =
        parseDateTime(patch?.otStart ?? work.otStart) ??
        addMinutes(coreEndAt(workDate), WorkPolicy.REST_EXTRA);
      const mainEnd = enforceMainEnd(workDate, addMinutes(otStart, -WorkPolicy.REST_EXTRA));
      return {
        mainEnd: formatDateTime(workDate, mainEnd),
        otStart: formatDateTime(workDate, otStart),
        otEnd: formatDateTime(workDate, truncatedEnd)
      };
    }
    case "raw_start":
    case "raw_end":
    case "auto":
    default:
      return autoOtAnchors(work);
  }
}

/** 출퇴근 기준 자동 야근 앵커 (기본 main 8시간 분할) */
export function autoOtAnchors(
  work: Pick<Work, "workDate" | "rawStart" | "rawEnd" | "dayType">
): OtAnchorPatch {
  const rawStart = parseDateTime(work.rawStart);
  const rawEnd = parseDateTime(work.rawEnd);
  if (!rawStart || !rawEnd) {
    return {};
  }

  const workDate = work.workDate;
  const actual = computeActualOtMinutes(workDate, rawStart, rawEnd, work.dayType);
  const extraRaw = Math.max(0, actual - WorkPolicy.STD_WORK);
  const extraTotal = Math.floor(extraRaw / 10) * 10;
  const otEnd = truncateToTenMinutes(rawEnd);

  if (extraTotal === 0) {
    const mainEnd = enforceMainEnd(workDate, otEnd);
    return {
      mainEnd: formatDateTime(workDate, mainEnd),
      otStart: null,
      otEnd: formatDateTime(workDate, otEnd),
      clearOtStart: true
    };
  }

  const otStart = addMinutes(otEnd, -extraTotal);
  const mainEnd = enforceMainEnd(workDate, addMinutes(otStart, -WorkPolicy.REST_EXTRA));

  return {
    mainEnd: formatDateTime(workDate, mainEnd),
    otStart: formatDateTime(workDate, otStart),
    otEnd: formatDateTime(workDate, otEnd)
  };
}

export function computeMainMinutes(
  workDate: string,
  rawStart: Date,
  mainEnd: Date,
  dayType: DayType
): number {
  let total = minutesBetween(rawStart, mainEnd);

  const skipBreak =
    dayType === "PM" && rawStart.getTime() > atTime(workDate, WorkPolicy.LUNCH_END).getTime();
  if (!skipBreak) {
    total -= resolveBreakMinutes(workDate, rawStart, mainEnd);
  }

  if (dayType === "AM" || dayType === "PM") {
    total += WorkPolicy.STD_HALF;
  }

  return Math.max(0, total);
}

export function computeExtraSplit(
  workDate: string,
  otStart: Date,
  otEnd: Date
): { extra1: number; extra2: number; extraTotal: number } {
  const extraRaw = Math.max(0, minutesBetween(otStart, otEnd));
  const extraTotal = Math.floor(extraRaw / 10) * 10;
  if (extraTotal === 0) {
    return { extra1: 0, extra2: 0, extraTotal: 0 };
  }

  const split = atTime(workDate, WorkPolicy.OT_SPLIT);
  let extra1 = 0;
  let extra2 = 0;

  if (otEnd.getTime() > split.getTime()) {
    const extra2Start = otStart.getTime() > split.getTime() ? otStart : split;
    extra2 = minutesBetween(extra2Start, otEnd);
    extra1 = extraTotal - extra2;
  } else {
    extra1 = extraTotal;
  }

  return { extra1, extra2, extraTotal };
}

export function applyOtAnchorPatch(work: Work, patch: OtAnchorPatch): Work {
  const next: Work = { ...work };
  if (patch.clearMainEnd) {
    next.mainEnd = null;
  } else if (patch.mainEnd !== undefined) {
    next.mainEnd = patch.mainEnd;
  }
  if (patch.clearOtStart) {
    next.otStart = null;
  } else if (patch.otStart !== undefined) {
    next.otStart = patch.otStart;
  }
  if (patch.clearOtEnd) {
    next.otEnd = null;
  } else if (patch.otEnd !== undefined) {
    next.otEnd = patch.otEnd;
  }
  return next;
}

function computeActualOtMinutes(
  workDate: string,
  rawStart: Date,
  rawEnd: Date,
  dayType: DayType
): number {
  let total = minutesBetween(rawStart, rawEnd);

  const skipBreak =
    dayType === "PM" && rawStart.getTime() > atTime(workDate, WorkPolicy.LUNCH_END).getTime();
  if (!skipBreak) {
    total -= resolveBreakMinutes(workDate, rawStart, rawEnd);
  }

  if (dayType === "AM" || dayType === "PM") {
    total += WorkPolicy.STD_HALF;
  }

  return total - WorkPolicy.REST_EXTRA;
}

export interface OtPreviewDisplay {
  mainEnd: string | null;
  otStart: string | null;
  otCoreEligible: boolean;
}

export function coreEndAt(workDate: string): Date {
  return atTime(workDate, WorkPolicy.CORE_END);
}

/** 코어타임 종료 + 야근 휴게시간 (예: 17:00) */
export function otPreviewThresholdAt(workDate: string): Date {
  return addMinutes(coreEndAt(workDate), WorkPolicy.REST_EXTRA);
}

export function isMainEndBeforeCore(mainEnd: Date, workDate: string): boolean {
  return mainEnd.getTime() < coreEndAt(workDate).getTime();
}

/** 퇴근 시 야근을 취소해야 하는지 (코어타임+휴게 17:00 이하) */
export function shouldCancelOtOnCheckout(workDate: string, checkoutAt: Date): boolean {
  return checkoutAt.getTime() <= otPreviewThresholdAt(workDate).getTime();
}

export function syncOtAnchorsFromMainEnd(
  workDate: string,
  mainEnd: string
): { mainEnd: string; otStart: string } {
  const mainEndDt = enforceMainEnd(workDate, parseDateTime(mainEnd)!);
  return {
    mainEnd: formatDateTime(workDate, mainEndDt),
    otStart: formatDateTime(workDate, addMinutes(mainEndDt, WorkPolicy.REST_EXTRA))
  };
}

export function syncOtAnchorsFromOtStart(
  workDate: string,
  otStart: string
): { mainEnd: string; otStart: string } {
  const otStartDt = parseDateTime(otStart)!;
  const mainEndDt = enforceMainEnd(workDate, addMinutes(otStartDt, -WorkPolicy.REST_EXTRA));
  return {
    mainEnd: formatDateTime(workDate, mainEndDt),
    otStart: formatDateTime(workDate, otStartDt)
  };
}

/**
 * 일반근무 8시간(480분)이 채워지는 시각을 산출합니다.
 */
export function computeMainEndAtStdWork(
  workDate: string,
  rawStart: Date,
  dayType: DayType
): Date {
  let cursor = addMinutes(rawStart, 60);
  const maxEnd = addMinutes(rawStart, 16 * 60);

  while (cursor.getTime() <= maxEnd.getTime()) {
    if (computeMainMinutes(workDate, rawStart, cursor, dayType) >= WorkPolicy.STD_WORK) {
      return cursor;
    }
    cursor = addMinutes(cursor, 1);
  }

  return maxEnd;
}

/**
 * 야근 표시용 mainEnd·otStart (미저장).
 * 퇴근 전 3단계: 코어미준수 / 코어준수·main8h미만 / main8h충족
 */
export function resolveOtPreviewDisplay(
  work: Pick<
    Work,
    "workDate" | "rawStart" | "rawEnd" | "dayType" | "isOt" | "mainEnd" | "otStart" | "otEnd"
  >,
  asOf?: Date
): OtPreviewDisplay {
  if (!work.isOt || !work.rawStart) {
    return { mainEnd: null, otStart: null, otCoreEligible: true };
  }

  if (work.rawEnd) {
    const auto = autoOtAnchors(work);
    const mainEndStr = work.mainEnd ?? auto.mainEnd ?? null;
    const otStartStr = work.otStart ?? auto.otStart ?? null;
    const mainEndDt = parseDateTime(mainEndStr);
    const eligible = Boolean(mainEndDt && !isMainEndBeforeCore(mainEndDt, work.workDate));
    return {
      mainEnd: mainEndStr,
      otStart: eligible ? otStartStr : null,
      otCoreEligible: eligible
    };
  }

  if (!work.rawEnd && work.mainEnd) {
    const mainEndDt = parseDateTime(work.mainEnd);
    if (!mainEndDt) {
      return { mainEnd: null, otStart: null, otCoreEligible: true };
    }
    const eligible = !isMainEndBeforeCore(mainEndDt, work.workDate);
    const otStartStr =
      work.otStart ??
      formatDateTime(work.workDate, addMinutes(mainEndDt, WorkPolicy.REST_EXTRA));
    return {
      mainEnd: work.mainEnd,
      otStart: eligible ? otStartStr : null,
      otCoreEligible: eligible
    };
  }

  if (!asOf) {
    return { mainEnd: null, otStart: null, otCoreEligible: true };
  }

  const now = truncateToMinute(asOf);
  const workDate = work.workDate;
  const rawStart = parseDateTime(work.rawStart);
  if (!rawStart) {
    return { mainEnd: null, otStart: null, otCoreEligible: true };
  }

  // 1. 코어 미준수: 퇴근=현재, 야근=-
  if (now.getTime() <= otPreviewThresholdAt(workDate).getTime()) {
    return {
      mainEnd: formatDateTime(workDate, now),
      otStart: null,
      otCoreEligible: false
    };
  }

  const elapsedMain = computeElapsedMainMinutes(workDate, rawStart, now, work.dayType);

  // 3. main 8시간 충족: 퇴근=출근+8h(휴게반영), 야근=퇴근+휴게
  if (elapsedMain >= WorkPolicy.STD_WORK) {
    const mainEndDt = computeMainEndAtStdWork(workDate, rawStart, work.dayType);
    const otStartDt = addMinutes(mainEndDt, WorkPolicy.REST_EXTRA);
    return {
      mainEnd: formatDateTime(workDate, mainEndDt),
      otStart: formatDateTime(workDate, otStartDt),
      otCoreEligible: true
    };
  }

  // 2. 코어 준수·main 8h 미만: 퇴근=야근 역산, 야근=현재
  const otStartDt = now;
  const mainEndDt = addMinutes(otStartDt, -WorkPolicy.REST_EXTRA);
  const coreOk = !isMainEndBeforeCore(mainEndDt, workDate);

  return {
    mainEnd: formatDateTime(workDate, mainEndDt),
    otStart: coreOk ? formatDateTime(workDate, otStartDt) : null,
    otCoreEligible: coreOk
  };
}

export function computeElapsedMainMinutes(
  workDate: string,
  rawStart: Date,
  asOf: Date,
  dayType: DayType
): number {
  const end = truncateToMinute(asOf);
  let total = minutesBetween(rawStart, end);

  const skipBreak =
    dayType === "PM" && rawStart.getTime() > atTime(workDate, WorkPolicy.LUNCH_END).getTime();
  if (!skipBreak) {
    total -= resolveBreakMinutes(workDate, rawStart, end);
  }

  if (dayType === "AM" || dayType === "PM") {
    total += WorkPolicy.STD_HALF;
  }

  const capped =
    total > WorkPolicy.STD_WORK ? total - WorkPolicy.BREAK_OVER : total;
  return Math.max(0, capped);
}

function enforceMainEnd(workDate: string, candidate: Date): Date {
  const coreEnd = coreEndAt(workDate);
  return candidate.getTime() < coreEnd.getTime() ? coreEnd : candidate;
}

function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function atTime(workDate: string, time: { hour: number; minute: number }): Date {
  return new Date(`${workDate}T${pad2(time.hour)}:${pad2(time.minute)}:00`);
}

function formatDateTime(workDate: string, date: Date): string {
  return `${workDate} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function truncateToMinute(date: Date): Date {
  const copy = new Date(date);
  copy.setSeconds(0, 0);
  return copy;
}

function truncateToTenMinutes(date: Date): Date {
  const copy = new Date(date);
  copy.setSeconds(0, 0);
  copy.setMinutes(Math.floor(copy.getMinutes() / 10) * 10);
  return copy;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function minutesBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 60_000);
}

function resolveBreakMinutes(workDate: string, rawStart: Date, rawEnd: Date): number {
  const lunchStart = atTime(workDate, WorkPolicy.LUNCH_START);
  const lunchEnd = atTime(workDate, WorkPolicy.LUNCH_END);
  const overlap = overlapMinutes(rawStart, rawEnd, lunchStart, lunchEnd);
  return Math.min(overlap, WorkPolicy.BREAK_BASE);
}

function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end <= start) {
    return 0;
  }
  return Math.floor((end - start) / 60_000);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

// --- Week extra aggregation ---

export interface TodayExtraMinutes {
  extra1: number;
  extra2: number;
}

export function sumWeekExtra1Minutes(
  days: WeeklyDayRow[],
  todayWorkDate: string,
  todayExtraMinutes?: TodayExtraMinutes
): number {
  return days.reduce((sum, day) => {
    const extra1 =
      day.workDate === todayWorkDate ? (todayExtraMinutes?.extra1 ?? day.extra1) : day.extra1;
    return sum + extra1;
  }, 0);
}

export function sumWeekExtra2Minutes(
  days: WeeklyDayRow[],
  todayWorkDate: string,
  todayExtraMinutes?: TodayExtraMinutes
): number {
  return days.reduce((sum, day) => {
    const extra2 =
      day.workDate === todayWorkDate ? (todayExtraMinutes?.extra2 ?? day.extra2) : day.extra2;
    return sum + extra2;
  }, 0);
}

export function resolveDayExtraMinutes(
  day: WeeklyDayRow,
  todayWorkDate: string,
  todayExtraMinutes?: TodayExtraMinutes
): TodayExtraMinutes {
  if (day.workDate === todayWorkDate && todayExtraMinutes) {
    return todayExtraMinutes;
  }
  return {
    extra1: day.extra1,
    extra2: day.extra2
  };
}

export function dayExtraTotal(extra: TodayExtraMinutes): number {
  return extra.extra1 + extra.extra2;
}

// --- Report ---

export const OT_REPORT_NOTE = "선택적 근로시간제도 참가";

export interface OtReportRow {
  weekLabel: string;
  performDate: string;
  startTime: string;
  endTime: string;
  durationLabel: string;
  workType: "1형" | "2형";
  workDetail: string;
  note: string;
}

export interface BuiltOtReport {
  titleLine: string;
  rows: OtReportRow[];
}

interface OtDayContext {
  extra1: number;
  extra2: number;
  otStart: string | null;
  otEnd: string | null;
  remark: string | null;
}

export function buildOtReport(
  report: WeeklyReport,
  options: {
    todayWorkDate: string;
    todayOtContext?: OtDayContext;
    useLiveToday: boolean;
  }
): BuiltOtReport {
  const weekLabel = `${report.header.reportMonth}월 ${report.header.reportWeekNumber}주차`;
  const titleLine = "아래와 같이 시간외근무 실적을 보고드립니다.";

  const rows = report.days.flatMap((day) => {
    const context = resolveOtDayContext(day, options);
    return buildRowsForDay(day.workDate, weekLabel, context);
  });

  return { titleLine, rows };
}

function resolveOtDayContext(
  day: WeeklyDayRow,
  options: {
    todayWorkDate: string;
    todayOtContext?: OtDayContext;
    useLiveToday: boolean;
  }
): OtDayContext {
  if (options.useLiveToday && day.workDate === options.todayWorkDate && options.todayOtContext) {
    return options.todayOtContext;
  }

  return {
    extra1: day.extra1,
    extra2: day.extra2,
    otStart: day.otStart,
    otEnd: day.otEnd,
    remark: day.remark
  };
}

function buildRowsForDay(workDate: string, weekLabel: string, context: OtDayContext): OtReportRow[] {
  const rows: OtReportRow[] = [];
  const workDetail = context.remark?.trim() || "\u3000";

  if (context.extra1 > 0) {
    const segment = resolveSegmentTimes(workDate, context, "1형");
    rows.push(createRow(weekLabel, workDate, segment, "1형", context.extra1, workDetail));
  }

  if (context.extra2 > 0) {
    const segment = resolveSegmentTimes(workDate, context, "2형");
    rows.push(createRow(weekLabel, workDate, segment, "2형", context.extra2, workDetail));
  }

  return rows;
}

function resolveSegmentTimes(
  workDate: string,
  context: OtDayContext,
  workType: "1형" | "2형"
): { start: string; end: string } {
  if (context.otStart && context.otEnd) {
    const split = `${workDate} ${pad2(WorkPolicy.OT_SPLIT.hour)}:${pad2(WorkPolicy.OT_SPLIT.minute)}`;
    if (workType === "2형") {
      return {
        start: formatHm(split) === "-" ? "22:00" : formatHm(split),
        end: formatHm(context.otEnd)
      };
    }

    return {
      start: formatHm(context.otStart),
      end:
        context.extra2 > 0
          ? formatHm(split) === "-"
            ? "22:00"
            : formatHm(split)
          : formatHm(context.otEnd)
    };
  }

  return { start: "-", end: "-" };
}

function createRow(
  weekLabel: string,
  workDate: string,
  segment: { start: string; end: string },
  workType: "1형" | "2형",
  minutes: number,
  workDetail: string
): OtReportRow {
  return {
    weekLabel,
    performDate: workDate,
    startTime: segment.start,
    endTime: segment.end,
    durationLabel: formatOtDuration(minutes),
    workType,
    workDetail,
    note: OT_REPORT_NOTE
  };
}

export function formatOtDuration(minutes: number): string {
  const safe = Math.max(0, minutes);
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${hour}:${String(minute).padStart(2, "0")}`;
}
