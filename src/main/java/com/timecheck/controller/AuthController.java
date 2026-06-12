package com.timecheck.controller;

import com.timecheck.dto.LoginReq;
import com.timecheck.dto.ProfileReq;
import com.timecheck.dto.SignupReq;
import com.timecheck.dto.UserRsp;
import com.timecheck.service.AuthService;
import com.timecheck.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.HttpStatus;
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

    public AuthController(AuthService authService) {
        this.authService = authService;
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
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        authService.logout(httpRequest);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, UserRsp>> me() {
        UserRsp user = authService.getCurrUser();
        return ResponseEntity.ok(Map.of("user", user));
    }

    @GetMapping("/check")
    public ResponseEntity<Map<String, Boolean>> check(@RequestParam String name) {
        Long exceptUserId = SecurityUtils.getCurrentUserIdOrNull();
        return ResponseEntity.ok(Map.of("ok", authService.usernameOk(name, exceptUserId)));
    }

    @PutMapping("/me")
    public ResponseEntity<Map<String, UserRsp>> updateUser(
            @RequestBody ProfileReq req, HttpServletRequest httpRequest) {
        UserRsp user = authService.updateUser(req, httpRequest);
        return ResponseEntity.ok(Map.of("user", user));
    }
}

