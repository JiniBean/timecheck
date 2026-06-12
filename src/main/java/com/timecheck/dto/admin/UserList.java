package com.timecheck.dto.admin;

import java.util.List;

public record UserList(String weekStart, String weekEnd, List<UserDetail> users) {}
