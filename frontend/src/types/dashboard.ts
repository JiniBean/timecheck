export type TodayStatus = "BEFORE_CHECK_IN" | "WORKING" | "DONE";
export type DayType = "NOM" | "AM" | "PM" | "MON" | "ANN" | "HOL";

export interface Work {
  workId?: number;
  userId: number;
  workDate: string;
  rawStart: string | null;
  mainStart?: string | null;
  rawEnd: string | null;
  main: number;
  extra1: number;
  extra2: number;
  base?: number;
  mainEnd?: string | null;
  otStart?: string | null;
  otEnd?: string | null;
  dayType: DayType;
  isOt: boolean;
  lateIn?: string | null;
  earlyOut?: string | null;
  remark: string | null;
}

export interface WeeklySummary {
  workedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
  avgRequiredPerDayMinutes: number;
  remainingWorkDays: number;
}

export interface WeeklyDayRow {
  workDate: string;
  weekdayLabel: string;
  rawStart: string | null;
  rawEnd: string | null;
  main: number;
  extra1: number;
  extra2: number;
  isOt: boolean;
  mainEnd: string | null;
  otStart: string | null;
  otEnd: string | null;
  dayType: DayType;
  remark: string | null;
}

export interface WeeklyReportHeader {
  department: string;
  team: string;
  name: string;
  position: string | null;
  reportMonth: number;
  reportWeekNumber: number;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  summary: WeeklySummary;
  days: WeeklyDayRow[];
  header: WeeklyReportHeader;
}

export interface DashboardState {
  todayStatus: TodayStatus;
  todayWork: Work;
  weeklyReport: WeeklyReport;
  loading: boolean;
  actionLoading: boolean;
  errorMessage: string | null;
  toastMessage: string | null;
  lastSyncedAt: string | null;
}
