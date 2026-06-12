import type { DayType, WeeklyReport, Work } from "../types/dashboard";
import { localDateKey } from "../utils/localDate";
import { applyCalculatedFields } from "../utils/timeCalculator";
import { buildMainReportData, type MainReportApiResponse } from "../utils/main";
import http from "./http";

interface WorkResponse {
  work: Work | null;
}

export interface WorkMutationOptions {
  workDate?: string;
  rawStart?: string | null;
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

function todayWorkStorageKey(userId: number): string {
  return `timecheck-today-work-${userId}`;
}

export function loadCachedTodayWork(userId: number): Work | null {
  try {
    const raw = localStorage.getItem(todayWorkStorageKey(userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Work;
    if (parsed.workDate !== localDateKey()) {
      return null;
    }
    return withCalculatedFields(parsed, userId, parsed.workDate);
  } catch {
    return null;
  }
}

export async function checkIn(userId: number, options: WorkMutationOptions = {}): Promise<Work> {
  const workDate = options.workDate ?? localDateKey();
  const { data } = await http.post<WorkResponse>("/work/in", buildPayload(workDate, options));
  const normalized = withCalculatedFields(requireWork(data.work), userId, workDate);
  saveTodayWork(userId, normalized);
  return normalized;
}

export async function checkOut(userId: number, options: WorkMutationOptions = {}): Promise<Work> {
  const workDate = options.workDate ?? localDateKey();
  const { data } = await http.post<WorkResponse>("/work/out", buildPayload(workDate, options));
  const normalized = withCalculatedFields(requireWork(data.work), userId, workDate);
  saveTodayWork(userId, normalized);
  return normalized;
}

export async function saveWorkSettings(userId: number, options: WorkMutationOptions = {}): Promise<Work> {
  const today = options.workDate ?? localDateKey();
  const { data } = await http.patch<WorkResponse>("/work", buildPayload(today, options), {
    params: { date: today }
  });
  if (!data.work) {
    const empty = createEmptyWork(userId, today);
    saveTodayWork(userId, empty);
    return empty;
  }
  const normalized = withCalculatedFields(data.work, userId, today);
  saveTodayWork(userId, normalized);
  return normalized;
}

export async function fetchTodayWork(userId: number): Promise<Work> {
  const today = localDateKey();
  return fetchWork(userId, today);
}

export async function fetchWork(userId: number, workDate: string): Promise<Work> {
  const { data } = await http.get<WorkResponse>("/work", {
    params: { date: workDate }
  });
  if (!data.work) {
    return createEmptyWork(userId, workDate);
  }
  const normalized = withCalculatedFields(data.work, userId, workDate);
  if (workDate === localDateKey()) {
    saveTodayWork(userId, normalized);
  }
  return normalized;
}

interface WorkRangeResponse {
  records: Work[];
}

export async function fetchWorkRecordsInRange(
  userId: number,
  startDate: string,
  endDate: string
): Promise<Work[]> {
  const { data } = await http.get<WorkRangeResponse>("/work/range", {
    params: { start: startDate, end: endDate }
  });
  return (data.records ?? []).map((record) =>
    withCalculatedFields(record, userId, record.workDate)
  );
}

export async function fetchWeeklyReport(userId: number, referenceDate?: string): Promise<WeeklyReport> {
  const ref = referenceDate ?? localDateKey();
  const { data } = await http.get<MainReportApiResponse>("/work/week", {
    params: { date: ref }
  });
  const records = (data.records ?? []).map((record) =>
    withCalculatedFields(record, userId, record.workDate)
  );
  return buildMainReportData(
    {
      weekStart: data.weekStart,
      weekEnd: data.weekEnd,
      records,
      department: data.department ?? "",
      team: data.team ?? "",
      userName: data.userName ?? "",
      position: data.position ?? null
    },
    ref,
    userId
  );
}

export function createEmptyWork(userId: number, date: string): Work {
  return applyCalculatedFields({
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

function buildPayload(workDate: string, options: WorkMutationOptions) {
  const payload: Record<string, unknown> = {
    workDate,
    dayType: options.dayType,
    isOt: options.isOt,
    remark: options.remark
  };
  if (options.rawStart !== undefined) {
    payload.rawStart = options.rawStart;
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

function withCalculatedFields(source: Work, userId: number, date: string): Work {
  const work: Work = {
    workId: source.workId,
    userId: source.userId ?? userId,
    workDate: source.workDate ?? date,
    rawStart: source.rawStart ?? null,
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
  return applyCalculatedFields(work, asOf);
}

function requireWork(work: Work | null): Work {
  if (!work) {
    throw new Error("근무 기록을 받지 못했습니다.");
  }
  return work;
}

function saveTodayWork(userId: number, work: Work): void {
  localStorage.setItem(todayWorkStorageKey(userId), JSON.stringify(work));
}

export { todayWorkStorageKey as getTodayWorkStorageKey };
