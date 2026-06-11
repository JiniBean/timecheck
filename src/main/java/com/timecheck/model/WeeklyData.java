package com.timecheck.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.time.LocalDate;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** 주간 조회 API 응답 — 계산·집계는 프론트에서 Work 원시값으로 처리 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WeeklyData {

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate weekStart;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate weekEnd;

    private List<Work> records;

    private String department;
    private String team;
    private String userName;
}
