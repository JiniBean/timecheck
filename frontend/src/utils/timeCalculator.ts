import type { DayType, WeekDay, Work } from "../types/dashboard";
import { localDateKey } from "./localDate";
import { isDayOff } from "./dayType";
import {
  setAnchorPatch,
  autoOtAnchors,
  elapsedMainMin,
  extraSplit,
  mainMin,
  recalcOtAnchors,
  otPreview,
  truncateToMinute,
  type OtRecalcTrigger
} from "./ot";

export { otPreview, type OtPreviewDisplay } from "./ot";
import { formatDateTime, parseDateTime } from "./time";
import { WorkPolicy } from "./workPolicy";

export type { OtRecalcTrigger };

export interface CalcInput {
  workDate: string;
  rawStart: string | null;
  rawEnd: string | null;
  dayType: DayType;
  isOt: boolean;
  lateIn?: string | null;
  earlyOut?: string | null;
  mainEnd?: string | null;
  otStart?: string | null;
  otEnd?: string | null;
}

export interface CalcResult {
  base: number;
  main: number;
  extra1: number;
  extra2: number;
  otStart: string | null;
  otEnd: string | null;
  mainEnd: string | null;
}

export function toCalcInput(work: Work): CalcInput {
  return {
    workDate: work.workDate,
    rawStart: work.rawStart,
    rawEnd: work.rawEnd,
    dayType: work.dayType,
    isOt: work.isOt,
    lateIn: work.lateIn ?? null,
    earlyOut: work.earlyOut ?? null,
    mainEnd: work.mainEnd ?? null,
    otStart: work.otStart ?? null,
    otEnd: work.otEnd ?? null
  };
}

/** 출근만 있고 퇴근이 없는 진행 중 근무 */
export function isWorking(work: Pick<Work, "rawStart" | "rawEnd" | "dayType">): boolean {
  return Boolean(work.rawStart && !work.rawEnd && !isDayOff(work.dayType));
}

export interface WeekDayCtx {
  isToday: boolean;
  rawStart: string | null;
  rawEnd: string | null;
  dayType: DayType;
  isOt: boolean;
  isOff: boolean;
  isWorking: boolean;
}

/** 주간 행 + 오늘 병합본 기준 당일 근무 컨텍스트 */
export function weekDayCtx(
  day: WeekDay,
  todayDateKey: string,
  mergedToday: Work
): WeekDayCtx {
  const isToday = day.workDate === todayDateKey;
  const rawStart = isToday ? mergedToday.rawStart : day.rawStart;
  const rawEnd = isToday ? mergedToday.rawEnd : day.rawEnd;
  const dayType = isToday ? mergedToday.dayType : day.dayType;
  const isOt = isToday ? mergedToday.isOt : day.isOt;
  const slice = { rawStart, rawEnd, dayType };
  return {
    isToday,
    rawStart,
    rawEnd,
    dayType,
    isOt,
    isOff: isDayOff(dayType),
    isWorking: isWorking(slice)
  };
}

/**
 * 실시간 계산에 쓸 오늘 Work.
 * todayWork(출근 버튼·API)를 우선하고, 주간 테이블 row는 빈 값 보조로 병합합니다.
 * 전제: todayWork.workDate === todayDate (불일치 시 호출 전 ensureTodayWork로 갱신).
 */
export function mergeToday(
  todayWork: Work,
  weeklyDays: WeekDay[],
  todayDate: string = localDateKey()
): Work {
  const row = weeklyDays.find((day) => day.workDate === todayDate);

  return {
    ...todayWork,
    workDate: todayDate,
    rawStart: pickTimeValue(todayWork.rawStart, row?.rawStart),
    rawEnd: pickTimeValue(todayWork.rawEnd, row?.rawEnd),
    dayType: todayWork.dayType,
    isOt: todayWork.isOt,
    remark: todayWork.remark,
    mainEnd: todayWork.mainEnd ?? row?.mainEnd ?? null,
    otStart: todayWork.otStart ?? row?.otStart ?? null,
    otEnd: todayWork.otEnd ?? row?.otEnd ?? null
  };
}

function pickTimeValue(primary: string | null | undefined, fallback: string | null | undefined): string | null {
  if (primary != null && primary !== "") {
    return primary;
  }
  if (fallback != null && fallback !== "") {
    return fallback;
  }
  return null;
}

/** DB 원시값 + 계산 필드를 합친 Work (표시·집계용) */
export function withCalc(work: Work, asOf?: Date): Work {
  const calc = calcResult(work, asOf);
  return {
    ...work,
    base: calc.base,
    main: calc.main,
    extra1: calc.extra1,
    extra2: calc.extra2,
    otStart: calc.otStart,
    otEnd: calc.otEnd,
    mainEnd: calc.mainEnd
  };
}

/** 야근 앵커를 트리거에 맞게 갱신한 Work를 반환합니다. */
export function withOtRecalc(work: Work, trigger: OtRecalcTrigger, patch?: Parameters<typeof recalcOtAnchors>[2]): Work {
  const anchorPatch = recalcOtAnchors(work, trigger, patch);
  const merged = setAnchorPatch(work, anchorPatch);
  return withCalc(merged);
}

export function calcResult(work: Work, asOf?: Date): CalcResult {
  const input = toCalcInput(work);
  if (isDayOff(input.dayType)) {
    return {
      base: WorkPolicy.STD_WORK,
      main: WorkPolicy.STD_WORK,
      extra1: 0,
      extra2: 0,
      otStart: null,
      otEnd: null,
      mainEnd: null
    };
  }

  const base = calculateBase(input);
  const useLive = asOf != null && isWorking(work);
  const worked = useLive
    ? liveWorkMin(input, asOf)
    : calculateWork(input, input.dayType);

  return {
    base,
    main: clampMain(worked.main),
    extra1: worked.extra1,
    extra2: worked.extra2,
    otStart: worked.otStart,
    otEnd: worked.otEnd,
    mainEnd: worked.mainEnd
  };
}

export function workMin(input: CalcInput): CalcResult {
  const dayType = input.dayType;

  if (isDayOff(dayType)) {
    return {
      base: WorkPolicy.STD_WORK,
      main: WorkPolicy.STD_WORK,
      extra1: 0,
      extra2: 0,
      otStart: null,
      otEnd: null,
      mainEnd: null
    };
  }

  const base = calculateBase(input);
  const worked = calculateWork(input, dayType);
  return { base, ...worked };
}

export function liveMainMin(input: CalcInput, asOf: Date = new Date()): number {
  return liveWorkMin(input, asOf).main;
}

export function liveWorkMin(
  input: CalcInput,
  asOf: Date = new Date()
): Pick<CalcResult, "main" | "extra1" | "extra2" | "otStart" | "otEnd" | "mainEnd"> {
  if (!input.rawStart) {
    return { main: 0, extra1: 0, extra2: 0, otStart: null, otEnd: null, mainEnd: null };
  }

  const rawStart = parseDateTime(input.rawStart);
  if (!rawStart) {
    return { main: 0, extra1: 0, extra2: 0, otStart: null, otEnd: null, mainEnd: null };
  }

  if (input.isOt && !input.rawEnd) {
    const preview = otPreview(
      {
        workDate: input.workDate,
        rawStart: input.rawStart,
        rawEnd: input.rawEnd,
        dayType: input.dayType,
        isOt: input.isOt,
        mainEnd: input.mainEnd ?? null,
        otStart: input.otStart ?? null,
        otEnd: input.otEnd ?? null
      },
      asOf
    );
    const mainEndDt = parseDateTime(preview.mainEnd);
    const main = mainEndDt
      ? mainMin(input.workDate, rawStart, mainEndDt, input.dayType)
      : elapsedMainMin(input.workDate, rawStart, asOf, input.dayType);

    return {
      main,
      extra1: 0,
      extra2: 0,
      otStart: preview.otStart,
      otEnd: null,
      mainEnd: preview.mainEnd
    };
  }

  const rawEnd =
    input.rawEnd ?? formatDateTime(input.workDate, truncateToMinute(asOf));
  const result = workMin({ ...input, rawEnd });
  return {
    main: result.main,
    extra1: result.extra1,
    extra2: result.extra2,
    otStart: result.otStart,
    otEnd: result.otEnd,
    mainEnd: result.mainEnd
  };
}

function calculateBase(input: CalcInput): number {
  let offMins = 0;

  if (input.lateIn) {
    offMins += minutesBetween(
      atTime(input.workDate, WorkPolicy.STD_START),
      atTime(input.workDate, parseHm(input.lateIn))
    );
  }

  if (input.earlyOut) {
    offMins += minutesBetween(
      atTime(input.workDate, parseHm(input.earlyOut)),
      atTime(input.workDate, WorkPolicy.STD_END)
    );
  }

  offMins = Math.min(offMins, WorkPolicy.STD_WORK);
  return Math.max(WorkPolicy.STD_WORK - offMins, 0);
}

function calculateWork(
  input: CalcInput,
  dayType: DayType
): Pick<CalcResult, "main" | "extra1" | "extra2" | "otStart" | "otEnd" | "mainEnd"> {
  const rawStart = parseDateTime(input.rawStart);
  const rawEnd = parseDateTime(input.rawEnd);

  if (!rawStart || !rawEnd) {
    return { main: 0, extra1: 0, extra2: 0, otStart: null, otEnd: null, mainEnd: null };
  }

  if (input.isOt) {
    return calculateOtWork(input, dayType, rawStart, rawEnd);
  }

  const total = mainMin(input.workDate, rawStart, rawEnd, dayType);
  const main = clampMain(total > WorkPolicy.STD_WORK ? total - WorkPolicy.BREAK_MAIN : total);
  return {
    main,
    extra1: 0,
    extra2: 0,
    otStart: null,
    otEnd: null,
    mainEnd: formatDateTime(input.workDate, rawEnd)
  };
}

function calculateOtWork(
  input: CalcInput,
  dayType: DayType,
  rawStart: Date,
  rawEnd: Date
): Pick<CalcResult, "main" | "extra1" | "extra2" | "otStart" | "otEnd" | "mainEnd"> {
  const workDate = input.workDate;
  const auto = autoOtAnchors({
    workDate,
    rawStart: input.rawStart,
    rawEnd: input.rawEnd,
    dayType
  });

  const mainEndDt =
    parseDateTime(input.mainEnd) ??
    parseDateTime(auto.mainEnd ?? null) ??
    atTime(workDate, WorkPolicy.CORE_END);
  const otStartDt =
    parseDateTime(input.otStart) ??
    parseDateTime(auto.otStart ?? null) ??
    addMinutes(mainEndDt, WorkPolicy.BREAK_OVER);
  const otEndDt =
    parseDateTime(input.otEnd) ??
    parseDateTime(auto.otEnd ?? null) ??
    truncateToTenMinutes(rawEnd);

  const main = mainMin(workDate, rawStart, mainEndDt, dayType);
  const hasExtra = otStartDt.getTime() < otEndDt.getTime();
  const { extra1, extra2 } = hasExtra
    ? extraSplit(workDate, otStartDt, otEndDt)
    : { extra1: 0, extra2: 0 };

  return {
    main,
    extra1,
    extra2,
    otStart: hasExtra ? formatDateTime(workDate, otStartDt) : null,
    otEnd: formatDateTime(workDate, otEndDt),
    mainEnd: formatDateTime(workDate, mainEndDt)
  };
}

function parseHm(value: string): { hour: number; minute: number } {
  const [h, m] = value.slice(0, 5).split(":");
  return {
    hour: Math.min(23, Math.max(0, parseInt(h ?? "0", 10) || 0)),
    minute: Math.min(59, Math.max(0, parseInt(m ?? "0", 10) || 0))
  };
}

function atTime(workDate: string, time: { hour: number; minute: number }): Date {
  return new Date(`${workDate}T${pad2(time.hour)}:${pad2(time.minute)}:00`);
}

function truncateToTenMinutes(date: Date): Date {
  const copy = truncateToMinute(date);
  copy.setMinutes(Math.floor(copy.getMinutes() / 10) * 10);
  return copy;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function minutesBetween(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 60_000);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function clampMain(minutes: number): number {
  return Math.max(0, minutes);
}
