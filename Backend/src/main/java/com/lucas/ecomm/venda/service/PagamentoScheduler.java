package com.lucas.ecomm.venda.service;

import com.lucas.ecomm.venda.repository.PedidoRepository;
import java.time.Instant;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Fila persistente de pagamentos. */
@Component @EnableScheduling @Profile("!test & !integration")
public class PagamentoScheduler {
    private final PedidoRepository pedidos;
    private final PedidoService service;
    public PagamentoScheduler(PedidoRepository pedidos,PedidoService service) { this.pedidos=pedidos; this.service=service; }

    @Scheduled(fixedDelayString="${app.pagamento.intervalo-ms:1000}",initialDelayString="${app.pagamento.espera-inicial-ms:1000}")
    public void processarPendentes() {
        for(var id:pedidos.pagamentosPendentes(Instant.now(),PageRequest.of(0,25))) {
            try { service.processarAgendado(id); }
            catch(Exception erro) {
                // Mantém o pedido na fila após falha
                LoggerFactory.getLogger(getClass()).warn("Falha no processamento automático do pedido {}: {}",id,erro.getClass().getSimpleName());
            }
        }
    }
}
