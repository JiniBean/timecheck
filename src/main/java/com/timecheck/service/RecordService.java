package com.timecheck.service;

import com.timecheck.mapper.RecordMapper;
import com.timecheck.mapper.UserMapper;
import com.timecheck.model.DayType;
import com.timecheck.model.User;
import com.timecheck.model.WeeklyData;
import com.timecheck.model.Work;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class RecordService {

    private final RecordMapper recordMapper;
    private final UserMapper userMapper;

    public RecordService(RecordMapper recordMapper, UserMapper userMapper) {
        this.recordMapper = recordMapper;
        this.userMapper = userMapper;
    }

    public Map<String, Object> checkIn(Work req) {
        return saveRecord(req, RecordAction.CHECK_IN);
    }

    public Map<String, Object> checkOut(Work req) {
        return saveRecord(req, RecordAction.CHECK_OUT);
    }

    public Map<String, Object> saveSettings(Work req) {
        return saveRecord(req, RecordAction.SETTINGS);
    }

    public Work findWork(Long userId, LocalDate workDate) {
        if (userId == null || workDate == null) {
            return null;
        }
        return recordMapper.selectRecord(userId, workDate);
    }

    /** 이번 주(월~금) Work 원시 기록만 반환합니다. */
    public WeeklyData findWeeklyRecords(Long userId, LocalDate referenceDate) {
        if (userId == null) {
            throw new IllegalArgumentException("사용자 ID가 필요합니다.");
        }

        LocalDate ref = referenceDate != null ? referenceDate : LocalDate.now();
        LocalDate weekStart = ref.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(4);

        List<Work> records = recordMapper.selectRecordsBetweenDates(userId, weekStart, weekEnd);
        User user = userMapper.selectById(userId);

        return WeeklyData.builder()
                .weekStart(weekStart)
                .weekEnd(weekEnd)
                .records(records)
                .department(user != null ? nullToEmpty(user.getDepartment()) : "")
                .team(user != null ? nullToEmpty(user.getTeam()) : "")
                .userName(user != null ? nullToEmpty(user.getDisplayName()) : "")
                .build();
    }

    private Map<String, Object> saveRecord(Work req, RecordAction action) {
        Work newWork = initRequest(req);
        Work oldWork = recordMapper.selectRecord(newWork.getUserId(), newWork.getWorkDate());

        Work target = oldWork == null ? newWork : oldWork.toBuilder().build();

        if (oldWork != null) {
            mergeNew(target, newWork);
            applyClears(target, newWork);
        } else if (hasClearRequest(newWork)) {
            return buildResponse(null);
        }

        if (target.getIsOt() == null) {
            target.setIsOt(Boolean.FALSE);
        }

        if (!shouldKeepRemark(target)) {
            target.setRemark(null);
        }

        if (target.getDayType().isDayOff()) {
            clearTimes(target);
        } else if (action != RecordAction.SETTINGS) {
            validateAction(target, action);

            if (action == RecordAction.CHECK_OUT && target.getRawStart() == null) {
                throw new IllegalArgumentException("출근 시간이 필요합니다.");
            }
        }

        if (oldWork == null) {
            recordMapper.insertRecord(target);
        } else {
            recordMapper.updateRecord(target);
        }

        return buildResponse(recordMapper.selectRecord(target.getUserId(), target.getWorkDate()));
    }

    private Map<String, Object> buildResponse(Work work) {
        Map<String, Object> response = new HashMap<>();
        response.put("work", work);
        return response;
    }

    private Work initRequest(Work request) {
        Work target = request == null ? Work.builder().build() : request.toBuilder().build();

        if (target.getWorkDate() == null) {
            target.setWorkDate(
                    target.getRawStart() != null
                            ? target.getRawStart().toLocalDate()
                            : LocalDate.now());
        }

        String remark = target.getRemark();
        target.setRemark(remark == null || remark.trim().isEmpty() ? null : remark.trim());
        boolean clearRawStart = request != null && Boolean.TRUE.equals(request.getClearRawStart());
        boolean clearRawEnd = request != null && Boolean.TRUE.equals(request.getClearRawEnd());
        target.setClearRawStart(clearRawStart ? Boolean.TRUE : Boolean.FALSE);
        target.setClearRawEnd(clearRawEnd ? Boolean.TRUE : Boolean.FALSE);
        target.setClearMainStart(Boolean.FALSE);
        target.setClearMainEnd(Boolean.FALSE);
        target.setClearOtStart(Boolean.FALSE);
        target.setClearOtEnd(Boolean.FALSE);
        if (request != null) {
            if (Boolean.TRUE.equals(request.getClearMainEnd())) {
                target.setClearMainEnd(Boolean.TRUE);
            }
            if (Boolean.TRUE.equals(request.getClearOtStart())) {
                target.setClearOtStart(Boolean.TRUE);
            }
            if (Boolean.TRUE.equals(request.getClearOtEnd())) {
                target.setClearOtEnd(Boolean.TRUE);
            }
        }
        return target;
    }

    private boolean hasClearRequest(Work request) {
        return Boolean.TRUE.equals(request.getClearRawStart()) || Boolean.TRUE.equals(request.getClearRawEnd());
    }

    private void applyClears(Work target, Work request) {
        if (Boolean.TRUE.equals(request.getClearRawStart())) {
            target.setRawStart(null);
            target.setMainStart(null);
            target.setClearRawStart(Boolean.TRUE);
            target.setClearMainStart(Boolean.TRUE);
        }
        if (Boolean.TRUE.equals(request.getClearRawEnd())) {
            target.setRawEnd(null);
            target.setMainEnd(null);
            target.setOtStart(null);
            target.setOtEnd(null);
            target.setClearRawEnd(Boolean.TRUE);
            target.setClearMainEnd(Boolean.TRUE);
            target.setClearOtStart(Boolean.TRUE);
            target.setClearOtEnd(Boolean.TRUE);
        }
        if (Boolean.TRUE.equals(request.getClearMainEnd())) {
            target.setMainEnd(null);
            target.setClearMainEnd(Boolean.TRUE);
        }
        if (Boolean.TRUE.equals(request.getClearOtStart())) {
            target.setOtStart(null);
            target.setClearOtStart(Boolean.TRUE);
        }
        if (Boolean.TRUE.equals(request.getClearOtEnd())) {
            target.setOtEnd(null);
            target.setClearOtEnd(Boolean.TRUE);
        }
    }

    private void mergeNew(Work target, Work newWork) {
        if (newWork.getUserId() != null) {
            target.setUserId(newWork.getUserId());
        }
        if (newWork.getWorkDate() != null) {
            target.setWorkDate(newWork.getWorkDate());
        }
        if (newWork.getRawStart() != null) {
            target.setRawStart(newWork.getRawStart());
        }
        if (newWork.getRawEnd() != null) {
            target.setRawEnd(newWork.getRawEnd());
        }
        if (newWork.getMainStart() != null) {
            target.setMainStart(newWork.getMainStart());
        }
        if (newWork.getMainEnd() != null) {
            target.setMainEnd(newWork.getMainEnd());
        }
        if (newWork.getOtStart() != null) {
            target.setOtStart(newWork.getOtStart());
        }
        if (newWork.getOtEnd() != null) {
            target.setOtEnd(newWork.getOtEnd());
        }
        if (newWork.getIsOt() != null) {
            target.setIsOt(newWork.getIsOt());
        }
        if (newWork.getDayType() != null) {
            target.setDayType(newWork.getDayType());
        }
        if (newWork.getLateIn() != null) {
            target.setLateIn(newWork.getLateIn());
        }
        if (newWork.getEarlyOut() != null) {
            target.setEarlyOut(newWork.getEarlyOut());
        }
        if (newWork.getRemark() != null) {
            target.setRemark(newWork.getRemark());
        } else if (newWork.getDayType() != null && !shouldKeepRemark(target)) {
            target.setRemark(null);
        }
    }

    private boolean shouldKeepRemark(Work work) {
        return work.getDayType() == DayType.HOL || Boolean.TRUE.equals(work.getIsOt());
    }

    private void validateAction(Work target, RecordAction action) {
        if (action == RecordAction.CHECK_IN && target.getRawStart() == null) {
            LocalDateTime now = LocalDateTime.now();
            target.setRawStart(now);
            if (target.getWorkDate() == null) {
                target.setWorkDate(now.toLocalDate());
            }
        }

        if (action == RecordAction.CHECK_OUT && target.getRawEnd() == null) {
            target.setRawEnd(LocalDateTime.now());
        }
    }

    private void clearTimes(Work work) {
        work.setRawStart(null);
        work.setRawEnd(null);
        work.setMainStart(null);
        work.setMainEnd(null);
        work.setClearRawStart(Boolean.TRUE);
        work.setClearRawEnd(Boolean.TRUE);
        work.setClearMainStart(Boolean.TRUE);
        work.setClearMainEnd(Boolean.TRUE);
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private enum RecordAction {
        CHECK_IN,
        CHECK_OUT,
        SETTINGS
    }
}
