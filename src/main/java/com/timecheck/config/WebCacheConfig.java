package com.timecheck.config;

import java.util.concurrent.TimeUnit;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebCacheConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        CacheControl noCache = CacheControl.noCache();
        CacheControl immutableCache = CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable();

        registry.addResourceHandler("/index.html")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(noCache);
        registry.addResourceHandler("/sw.js")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(noCache);
        registry.addResourceHandler("/registerSW.js")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(noCache);
        registry.addResourceHandler("/manifest.webmanifest")
                .addResourceLocations("classpath:/static/")
                .setCacheControl(noCache);
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(immutableCache);
    }
}
