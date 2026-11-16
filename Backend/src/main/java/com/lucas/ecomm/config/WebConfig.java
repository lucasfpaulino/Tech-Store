package com.lucas.ecomm.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration(proxyBeanMethods = false)
public class WebConfig implements WebMvcConfigurer {

    private final List<String> allowedOrigins;
    private final PerfilAdminInterceptor perfilAdmin;

    public WebConfig(@Value("${app.cors.allowed-origins}") List<String> allowedOrigins, PerfilAdminInterceptor perfilAdmin) {
        this.allowedOrigins = allowedOrigins;
        this.perfilAdmin = perfilAdmin;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(perfilAdmin).addPathPatterns("/api/analises/vendas", "/api/analises/vendas/**");
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
