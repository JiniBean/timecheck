package com.timecheck.policy;

import java.time.LocalTime;

public final class WorkPolicy {

    public static final int STD_WORK = 480;
    public static final int STD_HALF = 240;

    public static final int BREAK_BASE = 60;
    public static final int BREAK_OVER = 0;
    public static final int REST_EXTRA = 60;

    public static final LocalTime STD_START = LocalTime.of(9, 0);
    public static final LocalTime STD_END = LocalTime.of(18, 0);
    public static final LocalTime CORE_START = LocalTime.of(10, 0);
    public static final LocalTime CORE_END = LocalTime.of(16, 0);
    public static final LocalTime LUNCH_START = LocalTime.of(11, 30);
    public static final LocalTime LUNCH_END = LocalTime.of(12, 30);

    public static final LocalTime OT_SPLIT = LocalTime.of(22, 0);

    private WorkPolicy() {
    }
}
