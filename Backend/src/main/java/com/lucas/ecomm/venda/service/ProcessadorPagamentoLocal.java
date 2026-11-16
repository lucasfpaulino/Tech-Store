package com.lucas.ecomm.venda.service;

import com.lucas.ecomm.cliente.model.CartaoModel;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Processador de pagamento simulado. */
@Service
public class ProcessadorPagamentoLocal implements ProcessadorPagamento {
    public Resultado autorizar(CartaoModel cartao,BigDecimal valor) {
        boolean valido=valor.signum()>0 && !YearMonth.parse(cartao.getValidade(),DateTimeFormatter.ofPattern("MM/yy")).isBefore(YearMonth.now());
        // Cartão fictício para simular recusa
        return new Resultado(valido&&!cartao.getUltimosDigitos().equals("0002"),"LOCAL-"+UUID.randomUUID());
    }
}
