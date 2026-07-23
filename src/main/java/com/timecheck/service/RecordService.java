package com.timecheck.service;

import com.timecheck.mapper.RecordMapper;
import com.timecheck.mapper.UserMapper;
import com.timecheck.model.DayType;
import com.timecheck.model.User;
import com.timecheck.model.WeeklyData;
import com.timecheck.model.Work;
import com.timecheck.util.DateRangeUtil;
import com.timecheck.util.DateRangeUtil.PeriodRange;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public Map<String, Object> patchWork(Work req) {
        return saveRecord(req, RecordAction.SETTINGS);
    }

    /** 이번 주 또는 미래 주의 미확정 미리보기 기록을 실제 Work로 일괄 저장합니다. */
    @Transactional
    public WeeklyData applyPrv(Long userId, List<Work> records) {
        if (userId == null) {
            throw new IllegalArgumentException("사용자 ID가 필요합니다.");
        }
        if (records == null
                || records.isEmpty()
                || records.get(0) == null
                || records.get(0).getWorkDate() == null) {
            throw new IllegalArgumentException("적용할 미리보기 기록이 없습니다.");
        }

        LocalDate today = LocalDate.now();
        PeriodRange currentWeek = DateRangeUtil.weekRange(today);
        PeriodRange targetWeek = DateRangeUtil.weekRange(records.get(0).getWorkDate());
        validatePrv(records, currentWeek, targetWeek, today);

        for (Work record : records) {
            Work existing = recordMapper.selectWork(userId, record.getWorkDate());
            if (existing != null
                    && (existing.getRawEnd() != null
                            || (existing.getDayType() != null && existing.getDayType().isDayOff()))) {
                continue;
            }

            Work target = existing == null ? Work.builder().build() : existing.toBuilder().build();
            target.setUserId(userId);
            target.setWorkDate(record.getWorkDate());
            target.setRawStart(
                    existing != null && existing.getRawStart() != null
                            ? existing.getRawStart()
                            : record.getRawStart());
            target.setRawEnd(record.getRawEnd());
            if (target.getRawStart() == null
                    || target.getRawEnd() == null
                    || !target.getRawEnd().isAfter(target.getRawStart())) {
                throw new IllegalArgumentException("최신 출근 기록보다 늦은 퇴근 시간이 필요합니다.");
            }
            target.setMainStart(target.getRawStart());
            saveRecord(target, RecordAction.SETTINGS);
        }

        return findWeek(userId, targetWeek.start());
    }

    public Work findWork(Long userId, LocalDate workDate) {
        if (userId == null || workDate == null) {
            return null;
        }
        return recordMapper.selectWork(userId, workDate);
    }

    /** 기간 내 Work 원시 기록을 반환합니다. */
    public List<Work> findWorks(Long userId, LocalDate startDate, LocalDate endDate) {
        if (userId == null) {
            throw new IllegalArgumentException("사용자 ID가 필요합니다.");
        }
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("조회 기간이 필요합니다.");
        }
        if (startDate.isAfter(endDate)) {
            throw new IllegalArgumentException("시작일은 종료일보다 늦을 수 없습니다.");
        }
        return recordMapper.selectWorks(userId, startDate, endDate);
    }

    /** 이번 주(월~금) Work 원시 기록만 반환합니다. */
    public WeeklyData findWeek(Long userId, LocalDate referenceDate) {
        if (userId == null) {
            throw new IllegalArgumentException("사용자 ID가 필요합니다.");
        }

        LocalDate ref = referenceDate != null ? referenceDate : LocalDate.now();
        LocalDate weekStart = ref.with(DayOfWeek.MONDAY);
        LocalDate weekEnd = weekStart.plusDays(4);

        List<Work> records = recordMapper.selectWorks(userId, weekStart, weekEnd);
        User user = userMapper.selectById(userId);

        return WeeklyData.builder()
                .weekStart(weekStart)
                .weekEnd(weekEnd)
                .records(records)
                .department(user != null ? nullToEmpty(user.getDepartment()) : "")
                .team(user != null ? nullToEmpty(user.getTeam()) : "")
                .name(user != null ? nullToEmpty(user.getName()) : "")
                .position(user != null ? user.getPosition() : null)
                .build();
    }

    private Map<String, Object> saveRecord(Work req, RecordAction action) {
        Work newWork = initRequest(req);
        Work oldWork = recordMapper.selectWork(newWork.getUserId(), newWork.getWorkDate());

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

        return buildResponse(recordMapper.selectWork(target.getUserId(), target.getWorkDate()));
    }

    private Map<String, Object> buildResponse(Work work) {
        Map<String, Object> response = new HashMap<>();
        response.put("work", work);
        return response;
    }

    private void validatePrv(
            List<Work> records, PeriodRange currentWeek, PeriodRange targetWeek, LocalDate today) {
        if (targetWeek.start().isBefore(currentWeek.start())) {
            throw new IllegalArgumentException("과거 주의 미리보기는 적용할 수 없습니다.");
        }

        Set<LocalDate> dates = new HashSet<>();
        for (Work record : records) {
            if (record == null
                    || record.getWorkDate() == null
                    || record.getRawStart() == null
                    || record.getRawEnd() == null) {
                throw new IllegalArgumentException("미리보기 출퇴근 시간이 필요합니다.");
            }

            LocalDate workDate = record.getWorkDate();
            if (workDate.isBefore(targetWeek.start()) || workDate.isAfter(targetWeek.end())) {
                throw new IllegalArgumentException("같은 주의 월요일부터 금요일 기록만 적용할 수 있습니다.");
            }
            if (targetWeek.start().equals(currentWeek.start()) && workDate.isBefore(today)) {
                throw new IllegalArgumentException("이번 주의 오늘 이후 기록만 적용할 수 있습니다.");
            }
            if (!dates.add(workDate)) {
                throw new IllegalArgumentException("같은 날짜의 미리보기 기록이 중복되었습니다.");
            }
            if (!record.getRawStart().toLocalDate().equals(workDate)
                    || (!record.getRawEnd().toLocalDate().equals(workDate)
                            && !record.getRawEnd().toLocalDate().equals(workDate.plusDays(1)))) {
                throw new IllegalArgumentException("출퇴근 날짜가 근무일 또는 익일과 일치하지 않습니다.");
            }
            if (!record.getRawEnd().isAfter(record.getRawStart())) {
                throw new IllegalArgumentException("퇴근 시간은 출근 시간보다 늦어야 합니다.");
            }
        }
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
