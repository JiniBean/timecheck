package com.timecheck.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

@Configuration
public class SessionCookieConfig {

    /**
     * Spring Session JDBC 쿠키(SESSION)를 브라우저 종료 후에도 유지되도록 설정합니다.
     * max-age 미설정 시 세션 쿠키로 동작하여 모바일 브라우저 앱 종료 시 로그아웃됩니다.
     */
    @Bean
    CookieSerializer cookieSerializer(
            @Value("${timecheck.session.cookie-max-age-seconds}") long maxAgeSeconds,
            @Value("${timecheck.session.cookie-secure}") boolean secure) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName("SESSION");
        serializer.setCookiePath("/");
        serializer.setSameSite("Lax");
        serializer.setUseHttpOnlyCookie(true);
        serializer.setUseSecureCookie(secure);
        int cookieMaxAge = maxAgeSeconds > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) maxAgeSeconds;
        serializer.setCookieMaxAge(cookieMaxAge);
        return serializer;
    }
}
