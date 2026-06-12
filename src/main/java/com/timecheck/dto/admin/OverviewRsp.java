package com.timecheck.dto.admin;

public record OverviewRsp(
        String period,
        int totalUsers,
        int newUsers,
        int activeUsers,
        int usersWithRecords,
        double adoptionRate,
        double checkInRate,
        int inactiveUsers) {}
