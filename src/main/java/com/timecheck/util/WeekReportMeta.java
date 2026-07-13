package com.timecheck.util;

import java.time.DayOfWeek;
import java.time.LocalDate;

public final class WeekReportMeta {

    private WeekReportMeta() {}

    /**
     * weekStart(월요일) 기준 해당 주 수요일.
     */
    public static LocalDate wednesdayOfWeekStart(LocalDate weekStart) {
        if (weekStart == null || weekStart.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new IllegalArgumentException("weekStart must be a Monday");
        }
        return weekStart.plusDays(2);
    }

    /**
     * 보고서 M월: 해당 주 수요일이 속한 달.
     */
    public static int reportMonthOfWeek(LocalDate weekStart) {
        return wednesdayOfWeekStart(weekStart).getMonthValue();
    }

    /**
     * 수요일이 속한 달의 N주차(그 달에 속한 수요일 순번, 1부터).
     */
    public static int weekNumberInMonth(LocalDate weekStart) {
        LocalDate wednesday = wednesdayOfWeekStart(weekStart);
        int count = 0;
        LocalDate cursor = wednesday.withDayOfMonth(1);
        while (!cursor.isAfter(wednesday)) {
            if (cursor.getDayOfWeek() == DayOfWeek.WEDNESDAY) {
                count++;
            }
            cursor = cursor.plusDays(1);
        }
        return Math.max(count, 1);
    }
}
