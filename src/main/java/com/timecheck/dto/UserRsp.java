package com.timecheck.dto;

import com.timecheck.model.User;

public record UserRsp(
        Long userId,
        String username,
        String userName,
        String department,
        String team,
        String position,
        String role) {

    public static UserRsp from(User user) {
        String role = user.getRole();
        if (role == null || role.isBlank()) {
            role = "USER";
        }
        return new UserRsp(
                user.getUserId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getDepartment(),
                user.getTeam(),
                user.getPosition(),
                role);
    }
}
