package com.timecheck.controller;

import com.timecheck.dto.admin.OverviewRsp;
import com.timecheck.dto.admin.UserDetail;
import com.timecheck.dto.admin.UserList;
import com.timecheck.dto.admin.UserUpdateReq;
import com.timecheck.service.AdminService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/overview")
    public ResponseEntity<Map<String, OverviewRsp>> overview(
            @RequestParam(defaultValue = "week") String period) {
        return ResponseEntity.ok(Map.of("overview", adminService.findOverview(period)));
    }

    @GetMapping("/users")
    public ResponseEntity<UserList> users(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(adminService.findUsers(department, status));
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<Map<String, UserDetail>> user(@PathVariable Long userId) {
        return ResponseEntity.ok(Map.of("user", adminService.findUser(userId)));
    }

    @PutMapping("/users/{userId}")
    public ResponseEntity<Map<String, UserDetail>> updateUser(
            @PathVariable Long userId, @RequestBody UserUpdateReq req) {
        return ResponseEntity.ok(Map.of("user", adminService.updateUser(userId, req)));
    }
}
