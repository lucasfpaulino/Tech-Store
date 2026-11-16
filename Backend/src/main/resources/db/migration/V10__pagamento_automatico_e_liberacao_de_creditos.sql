-- A emissão do crédito não o torna utilizável antes da aprovação da compra de origem.
ALTER TABLE cupons ADD COLUMN liberacao varchar(12) NOT NULL DEFAULT 'LIBERADO'
 CHECK(liberacao IN ('LIBERADO','PENDENTE','INVALIDADO'));
UPDATE cupons c SET liberacao='PENDENTE' FROM pedidos p
 WHERE p.cupom_saldo_id=c.id AND p.status='EM PROCESSAMENTO' AND NOT c.utilizado;
UPDATE cupons c SET liberacao='INVALIDADO' FROM pedidos p
 WHERE p.cupom_saldo_id=c.id AND p.status IN ('CANCELADO','REPROVADA');

-- Agendamento persistente: retoma o processamento mesmo após reiniciar o backend.
ALTER TABLE pedidos ADD COLUMN pagamento_agendado_em timestamptz;
UPDATE pedidos SET pagamento_agendado_em=now()+interval '5 seconds' WHERE status='EM PROCESSAMENTO';
CREATE INDEX idx_pedidos_pagamento_pendente ON pedidos(pagamento_agendado_em)
 WHERE status='EM PROCESSAMENTO' AND pagamento_agendado_em IS NOT NULL;
