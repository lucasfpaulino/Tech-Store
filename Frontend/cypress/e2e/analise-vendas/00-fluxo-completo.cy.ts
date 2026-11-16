import { abrirAnalise, conferirBloqueio, conferirEstadosDaMassa, consultarAnalise, entregarPelaTela, prepararAnalise } from '../../support/analise'

describe('Análise 00 — apresentação completa do histórico por categoria', () => {
  it('[RF0055][RNF0043][RNF0011] demonstra os oito cenários: mensal, comparação, período, ENTREGUE, atualização e acesso Admin', () => {
    prepararAnalise().then(base => {
      conferirEstadosDaMassa(base)
      cy.log('[Cenário 1][RF0055] Uma categoria: soma mensal dos itens ENTREGUE, conferida com o banco')
      abrirAnalise(true); consultarAnalise(base, [0], '2026-01-01', '2026-03-31')
      cy.log('[Cenários 2 e 3][RF0055][RNF0043] Uma consulta com 3 categorias, outra com 4 e outra com 2')
      consultarAnalise(base, [0, 1, 2], '2025-11-01', '2026-04-30')
      consultarAnalise(base, [0, 1, 3, 4], '2025-11-01', '2026-04-30'); cy.screenshot('analise-comparacao-categorias', { capture: 'viewport' })
      consultarAnalise(base, [2, 3], '2026-01-01', '2026-04-30')
      cy.log('[Cenário 4][RF0055][RF0056] Muda início e fim separadamente; os meses e valores mudam com cada consulta')
      consultarAnalise(base, [2, 3], '2026-02-01', '2026-04-30')
      consultarAnalise(base, [2, 3], '2026-02-01', '2026-06-30')
      cy.log('[Cenários 5 e 6][RF0055] Estados não ENTREGUE excluídos; confirmar entrega inclui R$ 300 em julho')
      consultarAnalise(base, [0, 1, 2], base.inicio, base.fimAtual); entregarPelaTela(base); consultarAnalise(base, [0, 1, 2], base.inicio, base.fimAtual)
      cy.reload(); cy.contains('h2', 'Vendas entregues por categoria').should('be.visible'); consultarAnalise(base, [0, 1, 2], base.inicio, base.fimAtual)
      cy.log('[Cenário 7] Cliente e visitante não acessam gráfico nem API; retorno ao Admin permitido')
      conferirBloqueio(base); abrirAnalise(true); consultarAnalise(base, [3, 4], '2026-01-01', '2026-05-31')
      cy.log('[Cenário 8][RNF0011] Todas as consultas acima verificaram individualmente duração ≤ 1.000 ms')
      cy.screenshot('analise-completa-entregues', { capture: 'viewport' })
    })
  })
})
