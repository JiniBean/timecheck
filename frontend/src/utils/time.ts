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

export function formatMinutes(minutes: number): string {
  if (minutes <= 0) {
    return "-";
  }

  return formatHmFromMinutes(minutes);
}

/** 분 → HH:mm (총근무시간 등, 0이면 00:00) */
export function formatHmFromMinutes(minutes: number): string {
  const safe = Math.max(0, minutes);
  const hour = Math.floor(safe / 60);
  const minute = safe % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function toCompactLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour}h ${minute}m`;
}

export function formatDurationKo(minutes: number): string {
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
