package com.timecheck.mapper;

import com.timecheck.dto.admin.UserRow;
import com.timecheck.model.User;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface AdminMapper {

    int countAllUsers();

    int countNewUsers(
            @Param("startDate") String startDate, @Param("endDate") String endDate);

    int countActiveUsers(
            @Param("startDate") String startDate, @Param("endDate") String endDate);

    int countUsersWithAnyWork();

    int countNomWorkDays(
            @Param("startDate") String startDate, @Param("endDate") String endDate);

    int countCheckInDays(
            @Param("startDate") String startDate, @Param("endDate") String endDate);

    int countInactiveUsers(
            @Param("inactiveSince") String inactiveSince,
            @Param("signupBefore") String signupBefore);

    int countAdmins();

    List<UserRow> selectUsers(
            @Param("weekStart") String weekStart,
            @Param("weekEnd") String weekEnd,
            @Param("inactiveSince") String inactiveSince,
            @Param("signupBefore") String signupBefore,
            @Param("department") String department,
            @Param("status") String status);

    UserRow selectUser(
            @Param("userId") Long userId,
            @Param("weekStart") String weekStart,
            @Param("weekEnd") String weekEnd,
            @Param("inactiveSince") String inactiveSince,
            @Param("signupBefore") String signupBefore);

    int updateUserByAdmin(User user);
}
