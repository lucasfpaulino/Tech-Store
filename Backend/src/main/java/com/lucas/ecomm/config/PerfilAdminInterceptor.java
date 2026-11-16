package com.lucas.ecomm.config;

import com.lucas.ecomm.shared.api.RegraException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Acesso pelo perfil local. */
@Component
public class PerfilAdminInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!"OPTIONS".equals(request.getMethod()) && !"ADMIN".equals(request.getHeader("X-Perfil")))
            throw new RegraException(HttpStatus.FORBIDDEN, "A análise de vendas está disponível somente para o administrador.");
        return true;
    }
}
