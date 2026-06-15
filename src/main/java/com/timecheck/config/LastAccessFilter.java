package com.timecheck.config;

import com.timecheck.security.SecurityUtils;
import com.timecheck.service.LastAccessService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.LOWEST_PRECEDENCE - 10)
public class LastAccessFilter extends OncePerRequestFilter {

    private final LastAccessService lastAccessService;

    public LastAccessFilter(LastAccessService lastAccessService) {
        this.lastAccessService = lastAccessService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/")) {
            return true;
        }
        return path.equals("/api/auth/login")
                || path.equals("/api/auth/signup")
                || path.equals("/api/auth/check");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        filterChain.doFilter(request, response);

        if (response.getStatus() >= 400) {
            return;
        }

        Long userId = SecurityUtils.getCurrentUserIdOrNull();
        if (userId != null) {
            lastAccessService.touch(userId);
        }
    }
}
