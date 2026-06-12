import type { Work } from "../types/dashboard";
import { shiftDateKey } from "./weekNav";

const OUTLIER_THRESHOLD_MINUTES = 30;
const LOOKBACK_DAYS = 30;

function parseCheckInMinutes(rawStart: string): number | null {
  const normalized = rawStart.includes("T") ? rawStart : rawStart.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getHours() * 60 + date.getMinutes();
}

function minutesToHhmm(minutes: number): string {
  const clamped = Math.min(23 * 60 + 59, Math.max(0, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** NOM 출근 기록에서 중앙값 기준 이상치를 제외한 평균 출근 시각(HH:mm) */
export function computeTypicalCheckInHhmm(records: Work[]): string | null {
  const minutes = records
    .filter((record) => record.dayType === "NOM" && record.rawStart)
    .map((record) => parseCheckInMinutes(record.rawStart!))
    .filter((value): value is number => value !== null);

  if (minutes.length === 0) {
    return null;
  }

  const center = median(minutes);
  const filtered = minutes.filter((value) => Math.abs(value - center) <= OUTLIER_THRESHOLD_MINUTES);
  const pool = filtered.length > 0 ? filtered : minutes;
  const average = pool.reduce((sum, value) => sum + value, 0) / pool.length;
  return minutesToHhmm(average);
}

/** today 기준 최근 30일 조회 구간 [start, end] (yyyy-MM-dd) */
export function recentCheckInRange(todayDateKey: string): { start: string; end: string } {
  return {
    start: shiftDateKey(todayDateKey, -(LOOKBACK_DAYS - 1)),
    end: todayDateKey
  };
}
