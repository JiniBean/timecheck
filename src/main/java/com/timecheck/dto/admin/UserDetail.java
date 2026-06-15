package com.timecheck.dto.admin;

import com.timecheck.model.Work;
import java.util.List;

public record UserDetail(
        Long userId,
        String username,
        String name,
        String department,
        String team,
        String position,
        String role,
        String createdAt,
        String lastActivityDate,
        int weekDays,
        int totalRecords,
        String status,
        List<Work> weekRecords) {}
