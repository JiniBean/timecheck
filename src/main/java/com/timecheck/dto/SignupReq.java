package com.timecheck.dto;

public record SignupReq(
        String username,
        String password,
        String name,
        String department,
        String team,
        String position) {}
