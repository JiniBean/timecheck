package com.timecheck.dto;

public record ProfileReq(
        String username,
        String password,
        String userName,
        String department,
        String team) {}
