function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(workDate: string, date: Date): string {
  return `${workDate} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatNowHm(date = new Date()): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function formatHm(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 분 → HH:mm (총근무시간 등, 0이면 00:00) */
export function fmtMinutes(minutes: number): string {
  const safe = Math.max(0, minutes);
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function hmToMinutes(value: string): number {
  const [h, m] = value.slice(0, 5).split(":");
  const hour = Number.parseInt(h ?? "0", 10) || 0;
  const minute = Number.parseInt(m ?? "0", 10) || 0;
  return hour * 60 + minute;
}

export function compareHm(a: string, b: string): number {
  return hmToMinutes(a) - hmToMinutes(b);
}

export function hhmmToDateTime(workDate: string, hhmm: string): string {
  const [h, m] = hhmm.slice(0, 5).split(":");
  return `${workDate} ${String(Number(h) || 0).padStart(2, "0")}:${String(Number(m) || 0).padStart(2, "0")}`;
}

export function fmtDurKo(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (hour > 0 && minute > 0) {
    return `${hour}시간 ${minute}분`;
  }
  if (hour > 0) {
    return `${hour}시간`;
  }
  return `${minute}분`;
}
