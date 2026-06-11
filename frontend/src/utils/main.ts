import type { WeeklyDayRow, WeeklyReport, WeeklyReportHeader, Work } from "../types/dashboard";
import { dayTypeLabel, isDayOff, workCellLabel } from "./dayType";
import { localDateKey } from "./localDate";
import { sumWeekExtra1Minutes, sumWeekExtra2Minutes, type TodayExtraMinutes } from "./ot";
import { EMPTY_CELL } from "./reportClipboard";
import { applyCalculatedFields } from "./timeCalculator";
import { formatHm, formatHmFromMinutes } from "./time";
import { mondayOfDateKey, shiftDateKey, weekNumberInMonth } from "./weekNav";
import { WorkPolicy } from "./workPolicy";

// --- Builder ---

const WEEKDAY_LABELS = ["", "월", "화", "수", "목", "금"];

export interface MainReportApiResponse {
  weekStart: string;
  weekEnd: string;
  records: Work[];
  department: string;
  team: string;
  userName: string;
}

export function buildMainReportData(
  payload: MainReportApiResponse,
  referenceDate: string,
  userId: number,
  asOf: Date = new Date()
): WeeklyReport {
  const weekStart = payload.weekStart || mondayOfDateKey(referenceDate);
  const weekEnd = payload.weekEnd || shiftDateKey(weekStart, 4);
  const today = localDateKey(asOf);
  const recordMap = new Map(payload.records.map((record) => [record.workDate, record]));

  const days: WeeklyDayRow[] = [];
  let workedMinutes = 0;
  let targetMinutes = 0;

  for (let offset = 0; offset < 5; offset++) {
    const workDate = shiftDateKey(weekStart, offset);
    const raw = recordMap.get(workDate) ?? emptyWork(userId, workDate);
    const calculated = applyCalculatedFields(raw, workDate === today ? asOf : undefined);
    days.push(toDayRow(workDate, calculated));
    workedMinutes += calculated.main;
    targetMinutes += calculated.base ?? WorkPolicy.STD_WORK;
  }

  const remainingMinutes = Math.max(targetMinutes - workedMinutes, 0);
  const remainingWorkDays = countRemainingWorkDaysExcludingToday(referenceDate, weekEnd);

  return {
    weekStart,
    weekEnd,
    summary: {
      workedMinutes,
      targetMinutes: targetMinutes || MAIN_WEEK_TARGET_MINUTES,
      remainingMinutes,
      avgRequiredPerDayMinutes: computeAvgRequiredPerDay(remainingMinutes, remainingWorkDays),
      remainingWorkDays
    },
    days,
    header: buildHeader(payload, weekStart)
  };
}

function emptyWork(userId: number, workDate: string): Work {
  return {
    userId,
    workDate,
    rawStart: null,
    rawEnd: null,
    main: 0,
    extra1: 0,
    extra2: 0,
    dayType: "NOM",
    isOt: false,
    remark: null
  };
}

function buildHeader(payload: MainReportApiResponse, weekStart: string): WeeklyReportHeader {
  return {
    department: payload.department ?? "",
    team: payload.team ?? "",
    userName: payload.userName ?? "",
    reportMonth: Number(weekStart.split("-")[1]) || 1,
    reportWeekNumber: weekNumberInMonth(weekStart)
  };
}

function toDayRow(workDate: string, work: Work): WeeklyDayRow {
  const weekday = new Date(`${workDate}T12:00:00`).getDay();
  const dayOff = isDayOff(work.dayType);

  return {
    workDate,
    weekdayLabel: WEEKDAY_LABELS[weekday] ?? "",
    rawStart: dayOff ? null : work.rawStart,
    rawEnd: dayOff ? null : work.rawEnd,
    main: work.main,
    extra1: work.extra1,
    extra2: work.extra2,
    isOt: work.isOt,
    mainEnd: dayOff ? null : work.mainEnd ?? null,
    otStart: dayOff ? null : work.otStart ?? null,
    otEnd: dayOff ? null : work.otEnd ?? null,
    dayType: work.dayType,
    remark: work.remark
  };
}

// --- Summary ---

export const MAIN_WEEK_TARGET_MINUTES = 40 * 60;

export interface MainSummaryInput {
  weeklyReport: WeeklyReport;
  todayWork: Work;
  todayWorkedMinutes: number;
  todayExtraMinutes?: TodayExtraMinutes;
  /** 오늘 일자(yyyy-MM-dd). 미지정 시 todayWork.workDate */
  todayDateKey?: string;
  /** false이면 서버 주간 데이터만 사용(과거/미래 주 조회) */
  useLiveToday?: boolean;
}

export interface MainSummaryResult {
  todayWorkedMinutes: number;
  weekWorkedMinutes: number;
  weekTargetMinutes: number;
  weekRemainingMinutes: number;
  weekOverMinutes: number;
  remainingWorkDays: number;
  avgRequiredPerDayMinutes: number;
  weekExtra1Minutes: number;
  weekExtra2Minutes: number;
  weekExtraTotalMinutes: number;
}

export function sumWeekWorkedMinutes(
  days: WeeklyDayRow[],
  todayWorkDate: string,
  todayWorkedMinutes: number
): number {
  return days.reduce((sum, day) => {
    const main = day.workDate === todayWorkDate ? todayWorkedMinutes : day.main;
    return sum + main;
  }, 0);
}

/** 오늘(포함) ~ 이번 주 금요일까지 남은 평일 수 */
export function countRemainingWorkDays(todayWorkDate: string, weekEnd: string): number {
  const today = parseDateKey(todayWorkDate);
  const end = parseDateKey(weekEnd);
  if (today > end) {
    return 1;
  }

  let count = 0;
  const cursor = new Date(today);
  while (cursor <= end) {
    const dayOfWeek = cursor.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.max(count, 1);
}

/** 내일 ~ 이번 주 금요일까지 남은 평일 수 (오늘 제외) */
export function countRemainingWorkDaysExcludingToday(todayWorkDate: string, weekEnd: string): number {
  const end = parseDateKey(weekEnd);
  const tomorrow = parseDateKey(shiftDateKey(todayWorkDate, 1));
  if (tomorrow > end) {
    return 0;
  }
  return countRemainingWorkDays(shiftDateKey(todayWorkDate, 1), weekEnd);
}

/** 주간 남은 분을 남은 평일 수로 나눈 값(올림) */
export function computeAvgRequiredPerDay(weekRemainingMinutes: number, remainingWorkDays: number): number {
  return Math.ceil(weekRemainingMinutes / Math.max(remainingWorkDays, 1));
}

export function computeMainSummary(input: MainSummaryInput): MainSummaryResult {
  const { weeklyReport, todayWork, todayWorkedMinutes } = input;
  const useLiveToday = input.useLiveToday ?? true;
  const todayDate = input.todayDateKey ?? todayWork.workDate;
  const weekTargetMinutes = weeklyReport.summary.targetMinutes || MAIN_WEEK_TARGET_MINUTES;
  const weekWorkedMinutes = useLiveToday
    ? sumWeekWorkedMinutes(weeklyReport.days, todayDate, todayWorkedMinutes)
    : weeklyReport.summary.workedMinutes;
  const weekRemainingMinutes = Math.max(0, weekTargetMinutes - weekWorkedMinutes);
  const weekOverMinutes = Math.max(0, weekWorkedMinutes - weekTargetMinutes);

  const remainingWorkDays = useLiveToday
    ? countRemainingWorkDaysExcludingToday(todayDate, weeklyReport.weekEnd)
    : weeklyReport.summary.remainingWorkDays;
  const avgRequiredPerDayMinutes = useLiveToday
    ? computeAvgRequiredPerDay(weekRemainingMinutes, remainingWorkDays)
    : weeklyReport.summary.avgRequiredPerDayMinutes;

  const todayExtraMinutes = useLiveToday ? input.todayExtraMinutes : undefined;
  const weekExtra1Minutes = sumWeekExtra1Minutes(weeklyReport.days, todayDate, todayExtraMinutes);
  const weekExtra2Minutes = sumWeekExtra2Minutes(weeklyReport.days, todayDate, todayExtraMinutes);

  return {
    todayWorkedMinutes,
    weekWorkedMinutes,
    weekTargetMinutes,
    weekRemainingMinutes,
    weekOverMinutes,
    remainingWorkDays,
    avgRequiredPerDayMinutes,
    weekExtra1Minutes,
    weekExtra2Minutes,
    weekExtraTotalMinutes: weekExtra1Minutes + weekExtra2Minutes
  };
}

function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00`);
}

// --- Report ---

export interface ReportTableRow {
  dateLabel: string;
  checkIn: string;
  checkOut: string;
  workLabel: string;
}

export interface ReportRemarkLine {
  index: number;
  text: string;
}

export interface BuiltMainReport {
  titleLine: string;
  workerLine: string;
  rows: ReportTableRow[];
  totalWorkLabel: string;
  remarks: ReportRemarkLine[];
  remarksFooter: string;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function buildMainReport(
  report: WeeklyReport,
  options: {
    todayWorkDate: string;
    todayWorkedMinutes: number;
    useLiveToday: boolean;
  }
): BuiltMainReport {
  const header = report.header;
  const titleLine = buildTitleLine(header);
  const workerLine = `근무자 : ${header.userName || "-"}`;
  const rows = report.days.map((day) => toReportRow(day, options));
  const totalMinutes = sumReportWorkedMinutes(report.days, options);
  const remarks = buildRemarks(report.days);

  return {
    titleLine,
    workerLine,
    rows,
    totalWorkLabel: formatHmFromMinutes(totalMinutes),
    remarks,
    remarksFooter: formatRemarksFooter(remarks)
  };
}

function buildTitleLine(header: WeeklyReportHeader): string {
  const dept = header.department?.trim() ?? "";
  const team = header.team?.trim() ?? "";
  const name = header.userName?.trim() ?? "";
  const prefix = [dept, team, name].filter(Boolean).join(" ");
  const suffix = prefix ? `${prefix} 사원` : "사원";
  return `${suffix} ${header.reportMonth}월 ${header.reportWeekNumber}주차 근무 결과 보고서입니다.`;
}

function toReportRow(
  day: WeeklyDayRow,
  options: { todayWorkDate: string; todayWorkedMinutes: number; useLiveToday: boolean }
): ReportTableRow {
  const main =
    options.useLiveToday && day.workDate === options.todayWorkDate
      ? options.todayWorkedMinutes
      : day.main;

  if (isDayOff(day.dayType)) {
    return {
      dateLabel: formatReportDateLabel(day.workDate),
      checkIn: EMPTY_CELL,
      checkOut: EMPTY_CELL,
      workLabel: workCellLabel(day.dayType, main)
    };
  }

  return {
    dateLabel: formatReportDateLabel(day.workDate),
    checkIn: formatHm(day.rawStart) === "-" ? EMPTY_CELL : formatHm(day.rawStart),
    checkOut: formatHm(day.rawEnd) === "-" ? EMPTY_CELL : formatHm(day.rawEnd),
    workLabel: workCellLabel(day.dayType, main)
  };
}

export function formatReportDateLabel(workDate: string): string {
  const date = new Date(`${workDate}T12:00:00`);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAY_KO[date.getDay()];
  return `${month}/${day}(${weekday})`;
}

function resolveReportMainMinutes(
  day: WeeklyDayRow,
  options: { todayWorkDate: string; todayWorkedMinutes: number; useLiveToday: boolean }
): number {
  if (isDayOff(day.dayType)) {
    return WorkPolicy.STD_WORK;
  }
  if (options.useLiveToday && day.workDate === options.todayWorkDate) {
    return options.todayWorkedMinutes;
  }
  return day.main;
}

function sumReportWorkedMinutes(
  days: WeeklyDayRow[],
  options: { todayWorkDate: string; todayWorkedMinutes: number; useLiveToday: boolean }
): number {
  return days.reduce((sum, day) => sum + resolveReportMainMinutes(day, options), 0);
}

function buildRemarks(days: WeeklyDayRow[]): ReportRemarkLine[] {
  return days
    .filter((day) => day.dayType !== "NOM")
    .sort((a, b) => a.workDate.localeCompare(b.workDate))
    .map((day, index) => ({
      index: index + 1,
      text: `${day.workDate}(${day.weekdayLabel}) ${formatRemarkBody(day)}`
    }));
}

function formatRemarkBody(day: WeeklyDayRow): string {
  const typeLabel = dayTypeLabel(day.dayType);
  const remark = day.remark?.trim();
  if (remark) {
    return `${remark} ${typeLabel}`;
  }
  return typeLabel;
}

function formatRemarksFooter(remarks: ReportRemarkLine[]): string {
  if (remarks.length === 0) {
    return "";
  }
  const lines = remarks.map((line) => `${line.index}. ${line.text}`);
  return `비고:\n${lines.join("\n")}`;
}
