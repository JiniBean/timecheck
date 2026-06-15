package com.timecheck.mapper;

import com.timecheck.model.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMapper {

    User selectById(@Param("userId") Long userId);

    User selectByUsername(@Param("username") String username);

    boolean existsByUsername(@Param("username") String username);

    boolean existsByUsernameExcept(
            @Param("username") String username, @Param("userId") Long userId);

    int insertUser(User user);

    int updateUser(User user);

    int updateLastAccess(@Param("userId") Long userId);
}
