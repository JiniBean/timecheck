package com.timecheck.mapper;

import com.timecheck.model.Work;
import java.time.LocalDate;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RecordMapper {

    Work selectWork(@Param("userId") Long userId, @Param("workDate") LocalDate workDate);

    List<Work> selectWorks(
            @Param("userId") Long userId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    List<Work> selectWorksAll(
            @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    int insertRecord(Work work);

    int updateRecord(Work work);
}
