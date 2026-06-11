package com.timecheck.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    private Long userId;
    private String username;
    /** USERS.PWD — API 응답에 포함하지 않음 */
    private String pwd;
    /** USERS.USER_NAME */
    private String displayName;
    private String department;
    private String team;
    /** USERS.POSITION — 직급 (nullable) */
    private String position;
}
