export const ADMIN_STATUS_LABEL: Record<string, string> = {
  active: "활성",
  inactive: "미사용",
  new: "신규"
};

export function formatAdminDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    const dateOnly = iso.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      const [year, month, day] = dateOnly.split("-");
      return `${year}. ${month}. ${day}.`;
    }
    return iso;
  }
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

export function adminStatusLabel(status: string): string {
  return ADMIN_STATUS_LABEL[status] ?? status;
}
