package com.timecheck.controller;

import com.timecheck.dto.admin.AdminList;
import com.timecheck.dto.admin.AdminOverviewRsp;
import com.timecheck.dto.admin.AdminUser;
import com.timecheck.dto.admin.AdminUserUpdateReq;
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
    public ResponseEntity<Map<String, AdminOverviewRsp>> overview(
            @RequestParam(defaultValue = "week") String period) {
        return ResponseEntity.ok(Map.of("overview", adminService.getOverview(period)));
    }

    @GetMapping("/users")
    public ResponseEntity<AdminList> users(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(adminService.listUsers(department, status));
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<Map<String, AdminUser>> user(@PathVariable Long userId) {
        return ResponseEntity.ok(Map.of("user", adminService.getUser(userId)));
    }

    @PutMapping("/users/{userId}")
    public ResponseEntity<Map<String, AdminUser>> updateUser(
            @PathVariable Long userId, @RequestBody AdminUserUpdateReq req) {
        return ResponseEntity.ok(Map.of("user", adminService.updateUser(userId, req)));
    }
}
