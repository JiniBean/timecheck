package com.timecheck.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.timecheck.mapper.RecordMapper;
import com.timecheck.mapper.UserMapper;
import com.timecheck.model.DayType;
import com.timecheck.model.WeeklyData;
import com.timecheck.model.Work;
import com.timecheck.util.DateRangeUtil;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RecordServiceTest {

    @Mock
    private RecordMapper recordMapper;

    @Mock
    private UserMapper userMapper;

    @InjectMocks
    private RecordService recordService;

    @Test
    void applyPrvStoresOnlyTrustedPreviewFields() {
        LocalDate today = requireWeekday();
        LocalDateTime rawStart = today.atTime(9, 0);
        LocalDateTime rawEnd = today.atTime(18, 0);
        Work request = Work.builder()
                .userId(999L)
                .workDate(today)
                .rawStart(rawStart)
                .rawEnd(rawEnd)
                .remark("무시")
                .build();
        Work stored = Work.builder()
                .userId(1L)
                .workDate(today)
                .rawStart(rawStart)
                .rawEnd(rawEnd)
                .build();

        when(recordMapper.selectWork(1L, today)).thenReturn(null, null, stored);
        when(recordMapper.selectWorks(any(), any(), any())).thenReturn(List.of(stored));

        WeeklyData response = recordService.applyPrv(1L, List.of(request));

        ArgumentCaptor<Work> captor = ArgumentCaptor.forClass(Work.class);
        verify(recordMapper).insertRecord(captor.capture());
        Work inserted = captor.getValue();
        assertEquals(1L, inserted.getUserId());
        assertEquals(rawStart, inserted.getMainStart());
        assertEquals(rawEnd, inserted.getRawEnd());
        assertNull(inserted.getRemark());
        assertEquals(List.of(stored), response.getRecords());
    }

    @Test
    void applyPrvKeepsCompletedRecord() {
        LocalDate today = requireWeekday();
        Work request = Work.builder()
                .workDate(today)
                .rawStart(today.atTime(9, 0))
                .rawEnd(today.atTime(18, 0))
                .build();
        Work existing = Work.builder()
                .userId(1L)
                .workDate(today)
                .rawStart(today.atTime(8, 50))
                .rawEnd(today.atTime(17, 50))
                .build();

        when(recordMapper.selectWork(1L, today)).thenReturn(existing);
        when(recordMapper.selectWorks(any(), any(), any())).thenReturn(List.of(existing));

        recordService.applyPrv(1L, List.of(request));

        verify(recordMapper, never()).insertRecord(any());
        verify(recordMapper, never()).updateRecord(any());
    }

    @Test
    void applyPrvKeepsLatestIncompleteCheckIn() {
        LocalDate today = requireWeekday();
        LocalDateTime requestStart = today.atTime(9, 0);
        LocalDateTime existingStart = today.atTime(9, 10);
        LocalDateTime rawEnd = today.atTime(18, 10);
        Work request = Work.builder()
                .workDate(today)
                .rawStart(requestStart)
                .rawEnd(rawEnd)
                .build();
        Work existing = Work.builder()
                .userId(1L)
                .workDate(today)
                .rawStart(existingStart)
                .build();
        Work stored = existing.toBuilder().rawEnd(rawEnd).build();

        when(recordMapper.selectWork(1L, today)).thenReturn(existing, existing, stored);
        when(recordMapper.selectWorks(any(), any(), any())).thenReturn(List.of(stored));

        recordService.applyPrv(1L, List.of(request));

        ArgumentCaptor<Work> captor = ArgumentCaptor.forClass(Work.class);
        verify(recordMapper).updateRecord(captor.capture());
        assertEquals(existingStart, captor.getValue().getRawStart());
        assertEquals(existingStart, captor.getValue().getMainStart());
    }

    @Test
    void applyPrvKeepsDayOffRecord() {
        LocalDate today = requireWeekday();
        Work request = Work.builder()
                .workDate(today)
                .rawStart(today.atTime(9, 0))
                .rawEnd(today.atTime(18, 0))
                .build();
        Work existing = Work.builder()
                .userId(1L)
                .workDate(today)
                .dayType(DayType.ANN)
                .build();

        when(recordMapper.selectWork(1L, today)).thenReturn(existing);
        when(recordMapper.selectWorks(any(), any(), any())).thenReturn(List.of(existing));

        recordService.applyPrv(1L, List.of(request));

        verify(recordMapper, never()).insertRecord(any());
        verify(recordMapper, never()).updateRecord(any());
    }

    @Test
    void applyPrvRejectsDuplicateDate() {
        LocalDate today = requireWeekday();
        Work record = Work.builder()
                .workDate(today)
                .rawStart(today.atTime(9, 0))
                .rawEnd(today.atTime(18, 0))
                .build();

        assertThrows(
                IllegalArgumentException.class,
                () -> recordService.applyPrv(1L, List.of(record, record.toBuilder().build())));

        verify(recordMapper, never()).insertRecord(any());
        verify(recordMapper, never()).updateRecord(any());
    }

    @Test
    void applyPrvRejectsInvalidTimeOrder() {
        LocalDate today = requireWeekday();
        Work record = Work.builder()
                .workDate(today)
                .rawStart(today.atTime(18, 0))
                .rawEnd(today.atTime(9, 0))
                .build();

        assertThrows(
                IllegalArgumentException.class,
                () -> recordService.applyPrv(1L, List.of(record)));
    }

    @Test
    void applyPrvRejectsPastRecord() {
        LocalDate workDate = LocalDate.now().minusDays(1);
        Work record = Work.builder()
                .workDate(workDate)
                .rawStart(workDate.atTime(9, 0))
                .rawEnd(workDate.atTime(18, 0))
                .build();

        assertThrows(
                IllegalArgumentException.class,
                () -> recordService.applyPrv(1L, List.of(record)));
    }

    @Test
    void applyPrvAllowsNextDayCheckout() {
        LocalDate today = requireWeekday();
        Work record = Work.builder()
                .workDate(today)
                .rawStart(today.atTime(18, 0))
                .rawEnd(today.plusDays(1).atTime(2, 0))
                .build();
        Work stored = record.toBuilder().userId(1L).build();

        when(recordMapper.selectWork(1L, today)).thenReturn(null, null, stored);
        when(recordMapper.selectWorks(any(), any(), any())).thenReturn(List.of(stored));

        recordService.applyPrv(1L, List.of(record));

        verify(recordMapper).insertRecord(any());
    }

    @Test
    void applyPrvStoresFutureWeekAndReturnsTargetWeek() {
        LocalDate futureMonday = DateRangeUtil.mondayOfWeek(LocalDate.now()).plusWeeks(1);
        Work record = Work.builder()
                .workDate(futureMonday)
                .rawStart(futureMonday.atTime(9, 0))
                .rawEnd(futureMonday.atTime(18, 0))
                .build();
        Work stored = record.toBuilder().userId(1L).build();

        when(recordMapper.selectWork(1L, futureMonday)).thenReturn(null, null, stored);
        when(recordMapper.selectWorks(1L, futureMonday, futureMonday.plusDays(4)))
                .thenReturn(List.of(stored));

        WeeklyData response = recordService.applyPrv(1L, List.of(record));

        verify(recordMapper).insertRecord(any());
        assertEquals(futureMonday, response.getWeekStart());
        assertEquals(futureMonday.plusDays(4), response.getWeekEnd());
        assertEquals(List.of(stored), response.getRecords());
    }

    @Test
    void applyPrvRejectsMixedWeeks() {
        LocalDate futureMonday = DateRangeUtil.mondayOfWeek(LocalDate.now()).plusWeeks(1);
        Work first = Work.builder()
                .workDate(futureMonday)
                .rawStart(futureMonday.atTime(9, 0))
                .rawEnd(futureMonday.atTime(18, 0))
                .build();
        LocalDate nextMonday = futureMonday.plusWeeks(1);
        Work second = Work.builder()
                .workDate(nextMonday)
                .rawStart(nextMonday.atTime(9, 0))
                .rawEnd(nextMonday.atTime(18, 0))
                .build();

        assertThrows(
                IllegalArgumentException.class,
                () -> recordService.applyPrv(1L, List.of(first, second)));

        verify(recordMapper, never()).insertRecord(any());
        verify(recordMapper, never()).updateRecord(any());
    }

    private LocalDate requireWeekday() {
        LocalDate today = LocalDate.now();
        Assumptions.assumeTrue(today.getDayOfWeek().getValue() <= DayOfWeek.FRIDAY.getValue());
        return today;
    }
}
