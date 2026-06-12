package com.timecheck.dto.admin;

import java.util.List;

public record AdminList(String weekStart, String weekEnd, List<AdminUser> users) {}
