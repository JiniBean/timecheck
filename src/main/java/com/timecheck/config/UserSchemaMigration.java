package com.timecheck.config;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;
import javax.sql.DataSource;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** 기존 SQLite DB에 USERS.POSITION·ROLE 컬럼이 없으면 추가함 */
@Component
public class UserSchemaMigration implements ApplicationRunner {

    private final DataSource dataSource;

    public UserSchemaMigration(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try (Connection conn = dataSource.getConnection()) {
            if (!hasColumn(conn.getMetaData(), "USERS", "POSITION")) {
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("ALTER TABLE USERS ADD COLUMN POSITION TEXT");
                }
            }
            if (!hasColumn(conn.getMetaData(), "USERS", "ROLE")) {
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("ALTER TABLE USERS ADD COLUMN ROLE TEXT NOT NULL DEFAULT 'USER'");
                }
            }
        }
    }

    private boolean hasColumn(DatabaseMetaData metaData, String table, String column) throws Exception {
        try (ResultSet rs = metaData.getColumns(null, null, table, column)) {
            return rs.next();
        }
    }
}
