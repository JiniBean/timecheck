import { localDateKey } from "./localDate";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(dateKey: string): boolean {
  return DATE_KEY_RE.test(dateKey);
}

export function currentDateKey(): string {
  return localDateKey();
}

/** ISO date key(yyyy-MM-dd) 기준 해당 주 월요일 */
export function mondayOfDateKey(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return localDateKey(date);
}

export function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function isSameWeek(dateKeyA: string, dateKeyB: string): boolean {
  return mondayOfDateKey(dateKeyA) === mondayOfDateKey(dateKeyB);
}

/** weekStart(월요일) 기준 해당 주 수요일 */
export function wednesdayOfWeekStart(weekStart: string): string {
  return shiftDateKey(weekStart, 2);
}

/** 보고서 M월: 해당 주 수요일이 속한 달 */
export function reportMonthOfWeek(weekStart: string): number {
  const wednesday = wednesdayOfWeekStart(weekStart);
  return Number(wednesday.slice(5, 7)) || 1;
}

export function formatWeekLabel(weekStart: string): string {
  if (!isValidDateKey(weekStart)) {
    return "로딩 중";
  }
  const month = reportMonthOfWeek(weekStart);
  const weekNumber = weekNumberInMonth(weekStart);
  return `${month}월 ${weekNumber}주`;
}

/** 수요일이 속한 달의 N주차(그 달에 속한 수요일 순번, 1부터) */
export function weekNumberInMonth(weekStart: string): number {
  const wednesday = wednesdayOfWeekStart(weekStart);
  const monthStart = `${wednesday.slice(0, 8)}01`;
  let count = 0;
  let cursor = monthStart;

  while (cursor <= wednesday) {
    const weekday = new Date(`${cursor}T12:00:00`).getDay();
    if (weekday === 3) {
      count++;
    }
    cursor = shiftDateKey(cursor, 1);
  }

  return Math.max(count, 1);
}
