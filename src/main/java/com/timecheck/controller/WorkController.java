package com.timecheck.controller;

import com.timecheck.model.WeeklyData;
import com.timecheck.model.Work;
import com.timecheck.security.SecurityUtils;
import com.timecheck.service.RecordService;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/work")
public class WorkController {

    private final RecordService recordService;

    public WorkController(RecordService recordService) {
        this.recordService = recordService;
    }

    /** 지정 일자의 근무 기록을 조회합니다. */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getWork(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        Long userId = SecurityUtils.requireCurrentUserId();
        LocalDate targetDate = date != null ? date : LocalDate.now();
        Work work = recordService.findWork(userId, targetDate);
        Map<String, Object> response = new HashMap<>();
        response.put("work", work);
        return ResponseEntity.ok(response);
    }

    /** date가 속한 주(월~금) 근무 기록을 조회합니다. */
    @GetMapping("/week")
    public ResponseEntity<WeeklyData> getWeek(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        Long userId = SecurityUtils.requireCurrentUserId();
        WeeklyData data = recordService.findWeeklyRecords(userId, date);
        return ResponseEntity.ok(data);
    }

    @PostMapping("/in")
    public ResponseEntity<Map<String, Object>> checkIn(@RequestBody Work request) {
        request.setUserId(SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(recordService.checkIn(request));
    }

    @PostMapping("/out")
    public ResponseEntity<Map<String, Object>> checkOut(@RequestBody Work request) {
        request.setUserId(SecurityUtils.requireCurrentUserId());
        return ResponseEntity.ok(recordService.checkOut(request));
    }

    /** 근무유형·야근·비고·수동 시간을 저장합니다. */
    @PatchMapping
    public ResponseEntity<Map<String, Object>> patchWork(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestBody Work request) {
        request.setUserId(SecurityUtils.requireCurrentUserId());
        if (date != null) {
            request.setWorkDate(date);
        }
        return ResponseEntity.ok(recordService.saveSettings(request));
    }
}
