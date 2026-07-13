import type { WeekDay, WeekReport, ReportHeader, Work } from "../types/dashboard";
import { dayTypeLabel, isDayOff, workCellLabel } from "./dayType";
import { localDateKey } from "./localDate";
import { sumExtra1, sumExtra2, type DayExtra } from "./ot";
import { EMPTY_CELL } from "./reportClipboard";
import { withCalc } from "./timeCalculator";
import { formatHm, fmtMinutes } from "./time";
import { mondayOfDateKey, shiftDateKey, weekNumberInMonth } from "./weekNav";
import { WorkPolicy } from "./workPolicy";

// --- Builder ---

const WEEKDAY_LABELS = ["", "월", "화", "수", "목", "금"];

export interface WeekApiRsp {
  weekStart: string;
  weekEnd: string;
  records: Work[];
  department: string;
  team: string;
  name: string;
  position: string | null;
}

export function buildWeekReport(
  payload: WeekApiRsp,
  referenceDate: string,
  userId: number,
  asOf: Date = new Date()
): WeekReport {
  const weekStart = payload.weekStart || mondayOfDateKey(referenceDate);
  const weekEnd = payload.weekEnd || shiftDateKey(weekStart, 4);
  const today = localDateKey(asOf);
  const recordMap = new Map(payload.records.map((record) => [record.workDate, record]));

  const days: WeekDay[] = [];
  let workedMinutes = 0;
  let targetMinutes = 0;

  for (let offset = 0; offset < 5; offset++) {
    const workDate = shiftDateKey(weekStart, offset);
    const raw = recordMap.get(workDate) ?? emptyWork(userId, workDate);
    const calculated = withCalc(raw, workDate === today ? asOf : undefined);
    days.push(toDayRow(workDate, calculated));
    workedMinutes += calculated.main;
    targetMinutes += calculated.base ?? WorkPolicy.STD_WORK;
  }

  const remainingMinutes = Math.max(targetMinutes - workedMinutes, 0);
  const remainingDays = daysAfter(referenceDate, weekEnd);

  return {
    weekStart,
    weekEnd,
    summary: {
      workedMinutes,
      targetMinutes: targetMinutes || WEEK_TARGET_MIN,
      remainingMinutes,
      avgPerDayMin: avgPerDay(remainingMinutes, remainingDays),
      daysAfter: remainingDays
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

function buildHeader(payload: WeekApiRsp, weekStart: string): ReportHeader {
  return {
    department: payload.department ?? "",
    team: payload.team ?? "",
    name: payload.name ?? "",
    position: payload.position ?? null,
    reportMonth: Number(weekStart.split("-")[1]) || 1,
    weekNum: weekNumberInMonth(weekStart)
  };
}

function toDayRow(workDate: string, work: Work): WeekDay {
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

export const WEEK_TARGET_MIN = 40 * 60;

export interface WeekSummary {
  main: number;
  base: number;
  goalMet: boolean;
}

export function weekSummary(
  records: Work[],
  weekStart: string,
  weekEnd: string,
  userId: number,
  asOf: Date = new Date()
): WeekSummary {
  const report = buildWeekReport(
    {
      weekStart,
      weekEnd,
      records,
      department: "",
      team: "",
      name: "",
      position: null
    },
    localDateKey(asOf),
    userId,
    asOf
  );

  const main = report.summary.workedMinutes;
  const base = report.summary.targetMinutes;

  return {
    main,
    base,
    goalMet: base > 0 && main >= base
  };
}

export interface SummaryIn {
  weeklyReport: WeekReport;
  todayWork: Work;
  todayMainMin: number;
  todayExtra?: DayExtra;
  /** 오늘 일자(yyyy-MM-dd). 미지정 시 todayWork.workDate */
  todayDateKey?: string;
  /** false이면 서버 주간 데이터만 사용(과거/미래 주 조회) */
  isLiveToday?: boolean;
}

export interface SummaryOut {
  todayMainMin: number;
  weekMainMin: number;
  weekTargetMin: number;
  weekRemMin: number;
  weekOverMin: number;
  daysAfter: number;
  avgPerDayMin: number;
  weekExtra1: number;
  weekExtra2: number;
  weekExtraTotal: number;
}

export function sumWeekMain(
  days: WeekDay[],
  todayWorkDate: string,
  todayMainMin: number
): number {
  return days.reduce((sum, day) => {
    const main = day.workDate === todayWorkDate ? todayMainMin : day.main;
    return sum + main;
  }, 0);
}

/** 오늘(포함) ~ 이번 주 금요일까지 남은 평일 수 */
export function daysInclToday(todayWorkDate: string, weekEnd: string): number {
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
export function daysAfter(todayWorkDate: string, weekEnd: string): number {
  const end = parseDateKey(weekEnd);
  const tomorrow = parseDateKey(shiftDateKey(todayWorkDate, 1));
  if (tomorrow > end) {
    return 0;
  }
  return daysInclToday(shiftDateKey(todayWorkDate, 1), weekEnd);
}

/** 주간 남은 분을 남은 평일 수로 나눈 값(올림) */
export function avgPerDay(weekRemMin: number, daysAfter: number): number {
  return Math.ceil(weekRemMin / Math.max(daysAfter, 1));
}

export function mainSummary(input: SummaryIn): SummaryOut {
  const { weeklyReport, todayWork, todayMainMin } = input;
  const isLiveToday = input.isLiveToday ?? true;
  const todayDate = input.todayDateKey ?? todayWork.workDate;
  const weekTargetMin = weeklyReport.summary.targetMinutes || WEEK_TARGET_MIN;
  const weekMainMin = isLiveToday
    ? sumWeekMain(weeklyReport.days, todayDate, todayMainMin)
    : weeklyReport.summary.workedMinutes;
  const weekRemMin = Math.max(0, weekTargetMin - weekMainMin);
  const weekOverMin = Math.max(0, weekMainMin - weekTargetMin);

  const remainingDays = isLiveToday
    ? daysAfter(todayDate, weeklyReport.weekEnd)
    : weeklyReport.summary.daysAfter;
  const avgPerDayMin = isLiveToday
    ? avgPerDay(weekRemMin, remainingDays)
    : weeklyReport.summary.avgPerDayMin;

  const todayExtra = isLiveToday ? input.todayExtra : undefined;
  const weekExtra1 = sumExtra1(weeklyReport.days, todayDate, todayExtra);
  const weekExtra2 = sumExtra2(weeklyReport.days, todayDate, todayExtra);

  return {
    todayMainMin,
    weekMainMin,
    weekTargetMin,
    weekRemMin,
    weekOverMin,
    daysAfter: remainingDays,
    avgPerDayMin,
    weekExtra1,
    weekExtra2,
    weekExtraTotal: weekExtra1 + weekExtra2
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

export interface WeekClip {
  titleLine: string;
  workerLine: string;
  rows: ReportTableRow[];
  totalWorkLabel: string;
  remarks: ReportRemarkLine[];
  remarksFooter: string;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export function buildWeekClip(
  report: WeekReport,
  options: {
    todayWorkDate: string;
    todayMainMin: number;
    isLiveToday: boolean;
  }
): WeekClip {
  const header = report.header;
  const titleLine = buildTitleLine(header);
  const workerLine = `근무자 : ${header.name || "-"}`;
  const rows = report.days.map((day) => toReportRow(day, options));
  const totalMinutes = sumReportWorkedMinutes(report.days, options);
  const remarks = buildRemarks(report.days);

  return {
    titleLine,
    workerLine,
    rows,
    totalWorkLabel: fmtMinutes(totalMinutes),
    remarks,
    remarksFooter: formatRemarksFooter(remarks)
  };
}

function buildTitleLine(header: ReportHeader): string {
  const dept = header.department?.trim() ?? "";
  const team = header.team?.trim() ?? "";
  const name = header.name?.trim() ?? "";
  const rank = header.position?.trim() || "사원";
  const prefix = [dept, team, name].filter(Boolean).join(" ");
  const suffix = prefix ? `${prefix} ${rank}` : rank;
  return `${suffix} ${header.reportMonth}월 ${header.weekNum}주차 근무 결과 보고서입니다.`;
}

function toReportRow(
  day: WeekDay,
  options: { todayWorkDate: string; todayMainMin: number; isLiveToday: boolean }
): ReportTableRow {
  const main =
    options.isLiveToday && day.workDate === options.todayWorkDate
      ? options.todayMainMin
      : day.main;

  if (isDayOff(day.dayType)) {
    return {
      dateLabel: fmtReportDate(day.workDate),
      checkIn: EMPTY_CELL,
      checkOut: EMPTY_CELL,
      workLabel: workCellLabel(day.dayType, main)
    };
  }

  return {
    dateLabel: fmtReportDate(day.workDate),
    checkIn: formatHm(day.rawStart) === "-" ? EMPTY_CELL : formatHm(day.rawStart),
    checkOut: formatHm(day.rawEnd) === "-" ? EMPTY_CELL : formatHm(day.rawEnd),
    workLabel: workCellLabel(day.dayType, main)
  };
}

export function fmtReportDate(workDate: string): string {
  const date = new Date(`${workDate}T12:00:00`);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAY_KO[date.getDay()];
  return `${month}/${day}(${weekday})`;
}

function resolveReportMainMinutes(
  day: WeekDay,
  options: { todayWorkDate: string; todayMainMin: number; isLiveToday: boolean }
): number {
  if (isDayOff(day.dayType)) {
    return WorkPolicy.STD_WORK;
  }
  if (options.isLiveToday && day.workDate === options.todayWorkDate) {
    return options.todayMainMin;
  }
  return day.main;
}

function sumReportWorkedMinutes(
  days: WeekDay[],
  options: { todayWorkDate: string; todayMainMin: number; isLiveToday: boolean }
): number {
  return days.reduce((sum, day) => sum + resolveReportMainMinutes(day, options), 0);
}

function buildRemarks(days: WeekDay[]): ReportRemarkLine[] {
  return days
    .filter((day) => day.dayType !== "NOM")
    .sort((a, b) => a.workDate.localeCompare(b.workDate))
    .map((day, index) => ({
      index: index + 1,
      text: `${day.workDate}(${day.weekdayLabel}) ${formatRemarkBody(day)}`
    }));
}

function formatRemarkBody(day: WeekDay): string {
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
