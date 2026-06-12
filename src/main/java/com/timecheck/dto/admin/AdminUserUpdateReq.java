package com.timecheck.dto.admin;

public record AdminUserUpdateReq(
        String userName,
        String department,
        String team,
        String position,
        String role) {}
