package com.timecheck.util;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.TemporalAdjusters;

public final class DateRangeUtil {

    private DateRangeUtil() {}

    public static LocalDate mondayOfWeek(LocalDate date) {
        return date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    public static LocalDate fridayOfWeek(LocalDate monday) {
        return monday.plusDays(4);
    }

    public static PeriodRange resolvePeriod(String period, LocalDate today) {
        String normalized = period == null ? "week" : period.trim().toLowerCase();
        return switch (normalized) {
            case "month" -> monthRange(today);
            case "all" -> new PeriodRange(null, null, "all");
            default -> weekRange(today);
        };
    }

    public static PeriodRange weekRange(LocalDate today) {
        LocalDate start = mondayOfWeek(today);
        return new PeriodRange(start, fridayOfWeek(start), "week");
    }

    public static PeriodRange monthRange(LocalDate today) {
        YearMonth ym = YearMonth.from(today);
        return new PeriodRange(ym.atDay(1), ym.atEndOfMonth(), "month");
    }

    public record PeriodRange(LocalDate start, LocalDate end, String label) {}
}
