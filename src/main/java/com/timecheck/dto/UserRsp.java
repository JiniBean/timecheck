package com.timecheck.dto;

import com.timecheck.model.User;

public record UserRsp(
        Long userId,
        String username,
        String userName,
        String department,
        String team) {

    public static UserRsp from(User user) {
        return new UserRsp(
                user.getUserId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getDepartment(),
                user.getTeam());
    }
}
