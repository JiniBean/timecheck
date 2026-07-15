package com.timecheck.controller;

import com.timecheck.dto.LoginReq;
import com.timecheck.dto.ProfileReq;
import com.timecheck.dto.SignupReq;
import com.timecheck.dto.UserRsp;
import com.timecheck.service.AuthService;
import com.timecheck.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final boolean sessionCookieSecure;

    public AuthController(
            AuthService authService,
            @Value("${timecheck.session.cookie-secure}") boolean sessionCookieSecure) {
        this.authService = authService;
        this.sessionCookieSecure = sessionCookieSecure;
    }

    @PostMapping("/signup")
    public ResponseEntity<Map<String, UserRsp>> signup(
            @RequestBody SignupReq req, HttpServletRequest httpRequest) {
        UserRsp user = authService.signup(req, httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("user", user));
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, UserRsp>> login(
            @RequestBody LoginReq req, HttpServletRequest httpRequest) {
        UserRsp user = authService.login(req, httpRequest);
        return ResponseEntity.ok(Map.of("user", user));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(
            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        authService.logout(httpRequest);
        expireSessionCookie(httpResponse);
        return ResponseEntity.noContent().build();
    }

    /**
     * SESSION 쿠키 삭제. login 시 Set-Cookie와 동일하게 Secure/SameSite를 맞춰야
     * 브라우저가 Secure 쿠키를 실제로 제거한다.
     */
    private void expireSessionCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("SESSION", "")
                .path("/")
                .maxAge(0)
                .httpOnly(true)
                .secure(sessionCookieSecure)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, UserRsp>> me() {
        UserRsp user = authService.findMe();
        return ResponseEntity.ok(Map.of("user", user));
    }

    @GetMapping("/check")
    public ResponseEntity<Map<String, Boolean>> check(@RequestParam String name) {
        Long exceptUserId = SecurityUtils.getCurrentUserIdOrNull();
        return ResponseEntity.ok(Map.of("ok", authService.usernameOk(name, exceptUserId)));
    }

    @PutMapping("/me")
    public ResponseEntity<Map<String, UserRsp>> updateMe(
            @RequestBody ProfileReq req, HttpServletRequest httpRequest) {
        UserRsp user = authService.updateMe(req, httpRequest);
        return ResponseEntity.ok(Map.of("user", user));
    }
}

