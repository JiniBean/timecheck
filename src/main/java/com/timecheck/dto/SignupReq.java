package com.timecheck.dto;

public record SignupReq(
        String username,
        String password,
        String userName,
        String department,
        String team) {}
