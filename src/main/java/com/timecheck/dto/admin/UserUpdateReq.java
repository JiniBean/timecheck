package com.timecheck.dto.admin;

public record UserUpdateReq(
        String userName,
        String department,
        String team,
        String position,
        String role) {}
