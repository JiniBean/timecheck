package com.timecheck.config;

import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@EnableScheduling
public class StaleSessionCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(StaleSessionCleanupScheduler.class);

    private final JdbcTemplate jdbcTemplate;
    private final int staleAccessThresholdDays;

    public StaleSessionCleanupScheduler(
            JdbcTemplate jdbcTemplate,
            @Value("${timecheck.session.stale-access-threshold-days}") int staleAccessThresholdDays) {
        this.jdbcTemplate = jdbcTemplate;
        this.staleAccessThresholdDays = staleAccessThresholdDays;
    }

    /**
     * LAST_ACCESS_TIME 기준으로 장기 미접속 세션(고아 세션)을 삭제합니다.
     * Spring Session 기본 만료 정리(EXPIRY_TIME)와 별도로 동작합니다.
     */
    @Scheduled(cron = "${timecheck.session.stale-cleanup-cron}")
    public void cleanUpStaleSessions() {
        long cutoffEpochMillis =
                System.currentTimeMillis() - Duration.ofDays(staleAccessThresholdDays).toMillis();

        int attributesDeleted = jdbcTemplate.update(
                """
                DELETE FROM SPRING_SESSION_ATTRIBUTES
                WHERE SESSION_PRIMARY_ID IN (
                    SELECT PRIMARY_ID FROM SPRING_SESSION WHERE LAST_ACCESS_TIME < ?
                )
                """,
                cutoffEpochMillis);

        int sessionsDeleted = jdbcTemplate.update(
                "DELETE FROM SPRING_SESSION WHERE LAST_ACCESS_TIME < ?", cutoffEpochMillis);

        if (sessionsDeleted > 0) {
            log.info(
                    "고아 세션 정리: {}건 삭제 ({}일 미접속, 속성 {}건)",
                    sessionsDeleted,
                    staleAccessThresholdDays,
                    attributesDeleted);
        }
    }
}
