package com.timecheck.dto.admin;

public record UserUpdateReq(
        String name,
        String department,
        String team,
        String position,
        String role) {}
