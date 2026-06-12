package com.timecheck.dto.admin;

/** MyBatis 전용 — weekRecords는 서비스에서 enrich */
public record AdminUserRow(
        Long userId,
        String username,
        String userName,
        String department,
        String team,
        String position,
        String role,
        String createdAt,
        String lastActivityDate,
        int weekDays,
        int totalRecords,
        String status) {}
