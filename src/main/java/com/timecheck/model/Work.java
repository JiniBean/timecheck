package com.timecheck.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Builder.Default;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder(toBuilder = true)
public class Work {

    private Long workId;
    private Long userId;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate workDate;

    /** 원시 출근 일시(단말·사용자 기록) */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime rawStart;

    /** 원시 퇴근 일시(단말·사용자 기록) */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime rawEnd;

    /** 일반근무 인정 출근 일시 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime mainStart;

    /** 일반근무 인정 퇴근 일시 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime mainEnd;

    private Integer base;
    private Integer main;
    /** 시간외근무 1형(OT_SPLIT 이전, 분) */
    private Integer extra1;
    /** 시간외근무 2형(OT_SPLIT 이후, 분) */
    private Integer extra2;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime otStart;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm")
    private LocalDateTime otEnd;

    private Boolean isOt;
    @Default
    private DayType dayType = DayType.NOM;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime lateIn;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime earlyOut;

    private String remark;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private Boolean clearRawStart;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private Boolean clearRawEnd;

    private Boolean clearMainStart;

    private Boolean clearMainEnd;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private Boolean clearOtStart;

    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private Boolean clearOtEnd;

    public void setDayType(DayType dayType) {
        this.dayType = dayType == null ? DayType.NOM : dayType;
    }
}
