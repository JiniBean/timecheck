export const ADMIN_STATUS_LABEL: Record<string, string> = {
  active: "활성",
  inactive: "미사용",
  new: "신규"
};

const KST = "Asia/Seoul";

/** DB에 타임존 없이 저장된 시각을 KST로 해석 */
function parseStoredDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(`${normalized}+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseStoredDate(value: string): Date | null {
  const dateOnly = value.trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const date = new Date(`${dateOnly}T00:00:00+09:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return parseStoredDateTime(value);
}

export function formatAdminDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = parseStoredDate(iso);
  if (!date) {
    const dateOnly = iso.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      const [year, month, day] = dateOnly.split("-");
      return `${year}. ${month}. ${day}`;
    }
    return iso;
  }
  return date
    .toLocaleDateString("ko-KR", {
      timeZone: KST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    })
    .replace(/\.\s*$/, "");
}

export function fmtAdminDt(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = parseStoredDateTime(iso);
  if (!date) {
    return iso;
  }
  return date.toLocaleString("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

/** 모바일 사용자 목록 — 연도 생략 */
export function fmtAdminDtShort(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = parseStoredDateTime(iso);
  if (!date) {
    return iso;
  }
  return date.toLocaleString("ko-KR", {
    timeZone: KST,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export function adminStatusLabel(status: string): string {
  return ADMIN_STATUS_LABEL[status] ?? status;
}
