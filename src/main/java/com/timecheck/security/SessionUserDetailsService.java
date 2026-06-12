package com.timecheck.security;

import com.timecheck.mapper.UserMapper;
import com.timecheck.model.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class SessionUserDetailsService implements UserDetailsService {

    private final UserMapper userMapper;

    public SessionUserDetailsService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.selectByUsername(username);
        if (user == null || user.getPwd() == null) {
            throw new UsernameNotFoundException("사용자를 찾을 수 없습니다.");
        }
        return new SessionUser(user.getUserId(), user.getUsername(), user.getPwd(), user.getRole());
    }
}
