package com.timecheck.service;

import com.timecheck.dto.admin.OverviewRsp;
import com.timecheck.dto.admin.UserDetail;
import com.timecheck.dto.admin.UserList;
import com.timecheck.dto.admin.UserRow;
import com.timecheck.dto.admin.UserUpdateReq;
import com.timecheck.mapper.AdminMapper;
import com.timecheck.mapper.RecordMapper;
import com.timecheck.model.User;
import com.timecheck.model.Work;
import com.timecheck.security.SecurityUtils;
import com.timecheck.util.DateRangeUtil;
import com.timecheck.util.DateRangeUtil.PeriodRange;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminService {

    private static final String ROLE_USER = "USER";
    private static final String ROLE_ADMIN = "ADMIN";
    private static final int DEPARTMENT_MAX_LENGTH = 100;

    private final AdminMapper adminMapper;
    private final RecordMapper recordMapper;

    public AdminService(AdminMapper adminMapper, RecordMapper recordMapper) {
        this.adminMapper = adminMapper;
        this.recordMapper = recordMapper;
    }

    public OverviewRsp findOverview(String period) {
        LocalDate today = LocalDate.now();
        PeriodRange range = DateRangeUtil.resolvePeriod(period, today);

        String signupBefore = today.minusDays(7).toString();
        String inactiveSince = today.minusDays(14).toString();

        int totalUsers = adminMapper.countAllUsers();
        int newUsers = resolveNewUsers(range, today, totalUsers);
        int activeUsers = resolveActiveUsers(range, today);
        int usersWithRecords = adminMapper.countUsersWithAnyWork();
        int inactiveUsers = adminMapper.countInactiveUsers(inactiveSince, signupBefore);

        double adoptionRate = totalUsers == 0 ? 0.0 : (double) usersWithRecords / totalUsers;
        double checkInRate = resolveCheckInRate(range, today);

        return new OverviewRsp(
                range.label(),
                totalUsers,
                newUsers,
                activeUsers,
                usersWithRecords,
                roundRate(adoptionRate),
                roundRate(checkInRate),
                inactiveUsers);
    }

    public UserList findUsers(String department, String status) {
        LocalDate today = LocalDate.now();
        PeriodRange week = DateRangeUtil.weekRange(today);
        String weekStart = week.start().toString();
        String weekEnd = week.end().toString();

        List<UserRow> rows = adminMapper.selectUsers(
                weekStart,
                weekEnd,
                today.minusDays(14).toString(),
                today.minusDays(7).toString(),
                normalizeFilter(department),
                normalizeFilter(status));

        Map<Long, List<Work>> weekRecordsByUser = groupWeekRecords(week.start(), week.end());
        List<UserDetail> users = new ArrayList<>(rows.size());
        for (UserRow row : rows) {
            users.add(enrichWeekRecords(row, weekRecordsByUser.getOrDefault(row.userId(), List.of())));
        }

        return new UserList(weekStart, weekEnd, users);
    }

    public UserDetail findUser(Long userId) {
        LocalDate today = LocalDate.now();
        PeriodRange week = DateRangeUtil.weekRange(today);
        UserRow row = adminMapper.selectUser(
                userId,
                week.start().toString(),
                week.end().toString(),
                today.minusDays(14).toString(),
                today.minusDays(7).toString());
        if (row == null) {
            throw new IllegalArgumentException("사용자를 찾을 수 없습니다.");
        }
        List<Work> weekRecords = recordMapper.selectWorks(userId, week.start(), week.end());
        return enrichWeekRecords(row, weekRecords);
    }

    @Transactional
    public UserDetail updateUser(Long userId, UserUpdateReq req) {
        Long currentUserId = SecurityUtils.requireCurrentUserId();
        UserDetail existing = findUser(userId);

        String name = normalizeRequired(req.name(), "이름");
        String department = normalizeOptional(req.department());
        String team = normalizeOptional(req.team());
        String position = normalizeOptional(req.position());
        String role = normalizeRequired(req.role(), "역할");
        validateRole(role);

        if (ROLE_USER.equals(role)
                && isAdmin(existing.role())
                && userId.equals(currentUserId)) {
            throw new IllegalArgumentException("본인의 관리자 권한은 해제할 수 없습니다.");
        }

        if (ROLE_USER.equals(role) && isAdmin(existing.role())) {
            if (adminMapper.countAdmins() <= 1) {
                throw new IllegalArgumentException("마지막 관리자의 권한은 해제할 수 없습니다.");
            }
        }

        User update = User.builder()
                .userId(userId)
                .name(name)
                .department(department)
                .team(team)
                .position(position)
                .role(role)
                .build();
        adminMapper.updateUserByAdmin(update);
        return findUser(userId);
    }

    private Map<Long, List<Work>> groupWeekRecords(LocalDate weekStart, LocalDate weekEnd) {
        List<Work> records = recordMapper.selectWorksAll(weekStart, weekEnd);
        Map<Long, List<Work>> grouped = new HashMap<>();
        for (Work record : records) {
            grouped.computeIfAbsent(record.getUserId(), ignored -> new ArrayList<>()).add(record);
        }
        return grouped;
    }

    private UserDetail enrichWeekRecords(UserRow row, List<Work> weekRecords) {
        return new UserDetail(
                row.userId(),
                row.username(),
                row.name(),
                row.department(),
                row.team(),
                row.position(),
                row.role(),
                row.createdAt(),
                row.lastAccess(),
                row.lastActivityDate(),
                row.weekDays(),
                row.totalRecords(),
                row.status(),
                weekRecords);
    }

    private int resolveNewUsers(PeriodRange range, LocalDate today, int totalUsers) {
        if ("all".equals(range.label())) {
            String start = today.minusDays(30).toString();
            return adminMapper.countNewUsers(start, today.toString());
        }
        return adminMapper.countNewUsers(range.start().toString(), today.toString());
    }

    private int resolveActiveUsers(PeriodRange range, LocalDate today) {
        if ("all".equals(range.label())) {
            return adminMapper.countUsersWithAnyWork();
        }
        return adminMapper.countActiveUsers(range.start().toString(), today.toString());
    }

    private double resolveCheckInRate(PeriodRange range, LocalDate today) {
        String start;
        String end = today.toString();
        if ("all".equals(range.label())) {
            start = "2000-01-01";
        } else {
            start = range.start().toString();
        }
        int nomDays = adminMapper.countNomWorkDays(start, end);
        if (nomDays == 0) {
            return 0.0;
        }
        int checkIns = adminMapper.countCheckInDays(start, end);
        return (double) checkIns / nomDays;
    }

    private static boolean isAdmin(String role) {
        return ROLE_ADMIN.equals(role);
    }

    private static void validateRole(String role) {
        if (!ROLE_USER.equals(role) && !ROLE_ADMIN.equals(role)) {
            throw new IllegalArgumentException("유효하지 않은 역할입니다.");
        }
    }

    private double roundRate(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private String normalizeFilter(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeRequired(String value, String fieldName) {
        if (value == null) {
            throw new IllegalArgumentException(fieldName + "을(를) 입력해 주세요.");
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException(fieldName + "을(를) 입력해 주세요.");
        }
        return trimmed;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > DEPARTMENT_MAX_LENGTH) {
            throw new IllegalArgumentException("입력값은 " + DEPARTMENT_MAX_LENGTH + "자 이하여야 합니다.");
        }
        return trimmed;
    }
}
