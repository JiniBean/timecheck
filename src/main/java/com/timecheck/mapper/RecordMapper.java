package com.timecheck.mapper;

import com.timecheck.model.Work;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RecordMapper {

    /**
     * 사용자와 근무일자 기준으로 출퇴근 기록을 조회합니다.
     *
     * @param userId 사용자 ID
     * @param workDate 근무일자
     * @return 출퇴근 기록
     */
    Work selectRecord(@Param("userId") Long userId, @Param("workDate") LocalDate workDate);

    /**
     * 기간 내 출퇴근 기록을 조회합니다.
     *
     * @param userId 사용자 ID
     * @param startDate 시작일(포함)
     * @param endDate 종료일(포함)
     * @return 출퇴근 기록 목록
     */
    List<Work> selectRecordsBetweenDates(
            @Param("userId") Long userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    /**
     * 출퇴근 기록을 신규 생성합니다.
     *
     * @param work 기록 데이터
     * @return 영향받은 행 수
     */
    int insertRecord(Work work);

    /**
     * 출퇴근 기록을 갱신합니다.
     *
     * @param work 기록 데이터
     * @return 영향받은 행 수
     */
    int updateRecord(Work work);
}
