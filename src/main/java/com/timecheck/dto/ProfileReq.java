package com.timecheck.dto;

public record ProfileReq(
        String username,
        String password,
        String name,
        String department,
        String team,
        String position) {}
