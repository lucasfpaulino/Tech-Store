-- Critério específico da entrega de análise: somente ENTREGUE, por data da compra.
-- Índices anteriores são preservados para os demais fluxos.
CREATE INDEX idx_pedidos_entregues_analise ON pedidos(criado_em, id) WHERE status='ENTREGUE';
