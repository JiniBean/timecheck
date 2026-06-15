import type { DayType } from "../types/dashboard";

export const DAY_TYPE_OPTIONS: Array<{ value: DayType; label: string }> = [
  { value: "NOM", label: "일반근무" },
  { value: "HOL", label: "공휴일" },
  { value: "AM", label: "오전반차" },
  { value: "PM", label: "오후반차" },
  { value: "ANN", label: "연차" },
  { value: "MON", label: "월차" }
];

const DAY_OFF_TYPES: DayType[] = ["MON", "ANN", "HOL"];

export function isDayOff(dayType: DayType): boolean {
  return DAY_OFF_TYPES.includes(dayType);
}

export function dayTypeLabel(dayType: DayType): string {
  return DAY_TYPE_OPTIONS.find((option) => option.value === dayType)?.label ?? "일반근무";
}

export function workCellLabel(dayType: DayType, mainMinutes: number): string {
  if (isDayOff(dayType)) {
    return dayTypeLabel(dayType);
  }
  if (mainMinutes <= 0) {
    return "-";
  }
  const hour = Math.floor(mainMinutes / 60);
  const minute = mainMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
