import type { WeekReport, Work } from "../types/dashboard";
import { readUserJson, writeUserJson } from "./clientStorage";
import { localDateKey } from "./localDate";
import { buildWeekReport } from "./main";
import { withCalc } from "./timeCalculator";
import { mondayOfDateKey, shiftDateKey } from "./weekNav";

const RANGE_SCOPE = "work-range";
const TODAY_WORK_SCOPE = "today-work";

export interface WorkRangeHeader {
  department: string;
  team: string;
  name: string;
  position: string | null;
}

export interface WorkRangeCache {
  start: string;
  end: string;
  records: Work[];
  header: WorkRangeHeader;
  updatedAt: string;
}

export function rangeWindow(today: string = localDateKey()): {
  start: string;
  end: string;
} {
  return {
    start: shiftDateKey(today, -21),
    end: shiftDateKey(today, 21),
  };
}

export function readRange(userId: number): WorkRangeCache | null {
  return readUserJson<WorkRangeCache>(RANGE_SCOPE, userId);
}

function writeRange(userId: number, cache: WorkRangeCache): void {
  writeUserJson(RANGE_SCOPE, userId, cache);
}

export function putWork(userId: number, work: Work): void {
  const today = localDateKey();
  if (work.workDate === today) {
    writeUserJson(TODAY_WORK_SCOPE, userId, work);
  }

  const window = rangeWindow(today);
  if (work.workDate < window.start || work.workDate > window.end) {
    return;
  }

  const existing = readRange(userId);
  const header = existing?.header ?? {
    department: "",
    team: "",
    name: "",
    position: null,
  };
  const records = existing?.records ? [...existing.records] : [];
  const index = records.findIndex((row) => row.workDate === work.workDate);
  if (index >= 0) {
    records[index] = work;
  } else {
    records.push(work);
  }
  records.sort((a, b) => a.workDate.localeCompare(b.workDate));

  writeRange(userId, {
    start: existing?.start ?? window.start,
    end: existing?.end ?? window.end,
    records,
    header,
    updatedAt: new Date().toISOString(),
  });
}

export function mergeRecords(userId: number, records: Work[], header?: Partial<WorkRangeHeader>): void {
  const window = rangeWindow();
  const existing = readRange(userId);
  const map = new Map<string, Work>();
  for (const row of existing?.records ?? []) {
    if (row.workDate >= window.start && row.workDate <= window.end) {
      map.set(row.workDate, row);
    }
  }
  for (const row of records) {
    if (row.workDate >= window.start && row.workDate <= window.end) {
      map.set(row.workDate, row);
      if (row.workDate === localDateKey()) {
        writeUserJson(TODAY_WORK_SCOPE, userId, row);
      }
    }
  }

  const nextHeader: WorkRangeHeader = {
    department: header?.department ?? existing?.header.department ?? "",
    team: header?.team ?? existing?.header.team ?? "",
    name: header?.name ?? existing?.header.name ?? "",
    position: header?.position !== undefined ? header.position : (existing?.header.position ?? null),
  };

  writeRange(userId, {
    start: window.start,
    end: window.end,
    records: [...map.values()].sort((a, b) => a.workDate.localeCompare(b.workDate)),
    header: nextHeader,
    updatedAt: new Date().toISOString(),
  });
}

export function workOf(userId: number, workDate: string): Work | null {
  const range = readRange(userId);
  const found = range?.records.find((row) => row.workDate === workDate);
  if (!found) {
    return null;
  }
  const asOf = workDate === localDateKey() ? new Date() : undefined;
  return withCalc(found, asOf);
}

export function buildCachedWeek(userId: number, referenceDate: string): WeekReport | null {
  const range = readRange(userId);
  if (!range || range.records.length === 0) {
    return null;
  }
  const weekStart = mondayOfDateKey(referenceDate);
  const weekEnd = shiftDateKey(weekStart, 4);
  if (weekEnd < range.start || weekStart > range.end) {
    return null;
  }
  return buildWeekReport(
    {
      weekStart,
      weekEnd,
      records: range.records,
      department: range.header.department,
      team: range.header.team,
      name: range.header.name,
      position: range.header.position,
    },
    referenceDate,
    userId,
  );
}

export function syncedAtLabel(userId: number): string | null {
  const updatedAt = readRange(userId)?.updatedAt;
  if (!updatedAt) {
    return null;
  }
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
