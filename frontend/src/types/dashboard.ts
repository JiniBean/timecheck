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

export interface WeekSummary {
  workedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
  avgPerDayMin: number;
  daysAfter: number;
}

export interface WeekDay {
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

export interface ReportHeader {
  department: string;
  team: string;
  name: string;
  position: string | null;
  reportMonth: number;
  weekNum: number;
}

export interface WeekReport {
  weekStart: string;
  weekEnd: string;
  summary: WeekSummary;
  days: WeekDay[];
  header: ReportHeader;
}

export interface DashboardState {
  todayStatus: TodayStatus;
  todayWork: Work;
  weeklyReport: WeekReport;
  loading: boolean;
  actionLoading: boolean;
  errorMessage: string | null;
  toastMessage: string | null;
  lastSyncedAt: string | null;
}
