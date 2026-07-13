package com.timecheck.util;

import java.time.DayOfWeek;
import java.time.LocalDate;

public final class WeekReportMeta {

    private WeekReportMeta() {}

    /**
     * 월요일이 속한 달의 N주차(그 달에 속한 월요일 순번, 1부터).
     */
    public static int weekNumberInMonth(LocalDate weekMonday) {
        if (weekMonday == null || weekMonday.getDayOfWeek() != DayOfWeek.MONDAY) {
            throw new IllegalArgumentException("weekMonday must be a Monday");
        }
        int count = 0;
        LocalDate cursor = weekMonday.withDayOfMonth(1);
        while (!cursor.isAfter(weekMonday)) {
            if (cursor.getDayOfWeek() == DayOfWeek.MONDAY) {
                count++;
            }
            cursor = cursor.plusDays(1);
        }
        return Math.max(count, 1);
    }
}
