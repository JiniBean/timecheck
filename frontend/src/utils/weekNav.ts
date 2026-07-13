import { localDateKey } from "./localDate";

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

export function formatWeekLabel(weekStart: string): string {
  const month = Number(weekStart.slice(5, 7));
  const weekNumber = weekNumberInMonth(weekStart);
  return `${month}월 ${weekNumber}주`;
}

/** 해당 월에 속한 월요일 순번(1부터) */
export function weekNumberInMonth(weekMonday: string): number {
  const monthStart = `${weekMonday.slice(0, 8)}01`;
  let count = 0;
  let cursor = monthStart;

  while (cursor <= weekMonday) {
    const weekday = new Date(`${cursor}T12:00:00`).getDay();
    if (weekday === 1) {
      count++;
    }
    cursor = shiftDateKey(cursor, 1);
  }

  return Math.max(count, 1);
}
