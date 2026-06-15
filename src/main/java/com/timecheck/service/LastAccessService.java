package com.timecheck.service;

import com.timecheck.mapper.UserMapper;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class LastAccessService {

    private static final Duration THROTTLE = Duration.ofMinutes(5);

    private final UserMapper userMapper;
    private final ConcurrentHashMap<Long, Instant> recentTouches = new ConcurrentHashMap<>();

    public LastAccessService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public void touch(Long userId) {
        if (userId == null) {
            return;
        }
        Instant now = Instant.now();
        Instant previous = recentTouches.get(userId);
        if (previous != null && Duration.between(previous, now).compareTo(THROTTLE) < 0) {
            return;
        }
        recentTouches.put(userId, now);
        userMapper.updateLastAccess(userId);
    }
}
