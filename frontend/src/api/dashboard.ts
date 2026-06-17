import type { DayType, WeekReport, Work } from "../types/dashboard";
import { localDateKey } from "../utils/localDate";
import { withCalc as applyCalc } from "../utils/timeCalculator";
import { buildWeekReport, type WeekApiRsp } from "../utils/main";
import http from "./http";

interface WorkResponse {
  work: Work | null;
}

export interface WorkPatch {
  workDate?: string;
  rawStart?: string | null;
  mainStart?: string | null;
  rawEnd?: string | null;
  dayType?: DayType;
  isOt?: boolean;
  remark?: string | null;
  mainEnd?: string | null;
  otStart?: string | null;
  otEnd?: string | null;
  clearRawStart?: boolean;
  clearRawEnd?: boolean;
  clearMainEnd?: boolean;
  clearOtStart?: boolean;
  clearOtEnd?: boolean;
}

function todayWorkKey(userId: number): string {
  return `timecheck-today-work-${userId}`;
}

export function loadTodayCache(userId: number): Work | null {
  try {
    const raw = localStorage.getItem(todayWorkKey(userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Work;
    if (parsed.workDate !== localDateKey()) {
      return null;
    }
    return normalizeWork(parsed, userId, parsed.workDate);
  } catch {
    return null;
  }
}

export async function checkIn(userId: number, options: WorkPatch = {}): Promise<Work> {
  const workDate = options.workDate ?? localDateKey();
  const { data } = await http.post<WorkResponse>("/work/in", toPayload(workDate, options));
  const normalized = normalizeWork(requireWork(data.work), userId, workDate);
  saveTodayWork(userId, normalized);
  return normalized;
}

export async function checkOut(userId: number, options: WorkPatch = {}): Promise<Work> {
  const workDate = options.workDate ?? localDateKey();
  const { data } = await http.post<WorkResponse>("/work/out", toPayload(workDate, options));
  const normalized = normalizeWork(requireWork(data.work), userId, workDate);
  saveTodayWork(userId, normalized);
  return normalized;
}

export async function patchWork(userId: number, options: WorkPatch = {}): Promise<Work> {
  const today = options.workDate ?? localDateKey();
  const { data } = await http.patch<WorkResponse>("/work", toPayload(today, options), {
    params: { date: today }
  });
  if (!data.work) {
    const empty = emptyWork(userId, today);
    saveTodayWork(userId, empty);
    return empty;
  }
  const normalized = normalizeWork(data.work, userId, today);
  saveTodayWork(userId, normalized);
  return normalized;
}

export async function fetchWork(userId: number, workDate: string): Promise<Work> {
  const { data } = await http.get<WorkResponse>("/work", {
    params: { date: workDate }
  });
  if (!data.work) {
    return emptyWork(userId, workDate);
  }
  const normalized = normalizeWork(data.work, userId, workDate);
  if (workDate === localDateKey()) {
    saveTodayWork(userId, normalized);
  }
  return normalized;
}

interface WorkRangeResponse {
  records: Work[];
}

export async function fetchWorks(
  userId: number,
  startDate: string,
  endDate: string
): Promise<Work[]> {
  const { data } = await http.get<WorkRangeResponse>("/work/range", {
    params: { start: startDate, end: endDate }
  });
  return (data.records ?? []).map((record) =>
    normalizeWork(record, userId, record.workDate)
  );
}

export async function fetchWeek(userId: number, referenceDate?: string): Promise<WeekReport> {
  const ref = referenceDate ?? localDateKey();
  const { data } = await http.get<WeekApiRsp>("/work/week", {
    params: { date: ref }
  });
  return buildWeekReport(
    {
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      records: data.records ?? [],
      department: data.department ?? "",
      team: data.team ?? "",
      name: data.name ?? "",
      position: data.position ?? null
    },
    ref,
    userId
  );
}

export function emptyWork(userId: number, date: string): Work {
  return applyCalc({
    userId,
    workDate: date,
    rawStart: null,
    rawEnd: null,
    mainEnd: null,
    main: 0,
    extra1: 0,
    extra2: 0,
    dayType: "NOM",
    isOt: false,
    remark: null
  });
}

function toPayload(workDate: string, options: WorkPatch) {
  const payload: Record<string, unknown> = {
    workDate,
    dayType: options.dayType,
    isOt: options.isOt,
    remark: options.remark
  };
  if (options.rawStart !== undefined) {
    payload.rawStart = options.rawStart;
  }
  if (options.mainStart !== undefined) {
    payload.mainStart = options.mainStart;
  }
  if (options.rawEnd !== undefined) {
    payload.rawEnd = options.rawEnd;
  }
  if (options.mainEnd !== undefined) {
    payload.mainEnd = options.mainEnd;
  }
  if (options.otStart !== undefined) {
    payload.otStart = options.otStart;
  }
  if (options.otEnd !== undefined) {
    payload.otEnd = options.otEnd;
  }
  if (options.clearRawStart) {
    payload.clearRawStart = true;
  }
  if (options.clearRawEnd) {
    payload.clearRawEnd = true;
  }
  if (options.clearMainEnd) {
    payload.clearMainEnd = true;
  }
  if (options.clearOtStart) {
    payload.clearOtStart = true;
  }
  if (options.clearOtEnd) {
    payload.clearOtEnd = true;
  }
  return payload;
}

function normalizeWork(source: Work, userId: number, date: string): Work {
  const work: Work = {
    workId: source.workId,
    userId: source.userId ?? userId,
    workDate: source.workDate ?? date,
    rawStart: source.rawStart ?? null,
    mainStart: source.mainStart ?? null,
    rawEnd: source.rawEnd ?? null,
    main: source.main ?? 0,
    extra1: source.extra1 ?? 0,
    extra2: source.extra2 ?? 0,
    base: source.base,
    mainEnd: source.mainEnd ?? null,
    otStart: source.otStart ?? null,
    otEnd: source.otEnd ?? null,
    dayType: source.dayType ?? "NOM",
    isOt: source.isOt ?? false,
    lateIn: source.lateIn ?? null,
    earlyOut: source.earlyOut ?? null,
    remark: source.remark ?? null
  };
  const asOf = work.workDate === localDateKey() ? new Date() : undefined;
  return applyCalc(work, asOf);
}

function requireWork(work: Work | null): Work {
  if (!work) {
    throw new Error("근무 기록을 받지 못했습니다.");
  }
  return work;
}

function saveTodayWork(userId: number, work: Work): void {
  localStorage.setItem(todayWorkKey(userId), JSON.stringify(work));
}

export { todayWorkKey as getTodayWorkKey };
