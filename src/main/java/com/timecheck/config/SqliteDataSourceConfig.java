package com.timecheck.config;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SqliteDataSourceConfig {

    @Bean
    public DataSource dataSource(
            @Value("${spring.datasource.driver-class-name}") String driverClassName,
            @Value("${spring.datasource.url}") String url) throws IOException {
        ensureSqliteParentDirectory(url);
        return DataSourceBuilder.create()
                .driverClassName(driverClassName)
                .url(url)
                .build();
    }

    private void ensureSqliteParentDirectory(String jdbcUrl) throws IOException {
        if (!jdbcUrl.startsWith("jdbc:sqlite:")) {
            return;
        }
        String filePath = jdbcUrl.substring("jdbc:sqlite:".length());
        Path parent = Paths.get(filePath).toAbsolutePath().getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
    }
}
