package com.timecheck.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Locale;

public enum DayType {
    NOM,
    AM,
    PM,
    MON,
    ANN,
    HOL;

    @JsonCreator
    public static DayType from(String value) {
        if (value == null) {
            return NOM;
        }

        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return NOM;
        }

        return DayType.valueOf(normalized);
    }

    @JsonValue
    public String getCode() {
        return name();
    }

    public boolean isDayOff() {
        return this == MON || this == ANN || this == HOL;
    }

    public boolean isHalfDay() {
        return this == AM || this == PM;
    }

    public boolean isPM() {
        return this == PM;
    }
}
