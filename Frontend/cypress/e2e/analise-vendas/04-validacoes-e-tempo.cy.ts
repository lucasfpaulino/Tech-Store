import { abrirAnalise, conferirTempo, consultarAnalise, prepararAnalise } from '../../support/analise'
import { fill, selectProfile, submit } from '../../support/data'

describe('Análise 04 — validações e tempo de resposta', () => {
  it('[RF0056][RF0057][RN0072] informa erros para datas invertidas, período inválido e seleção vazia', () => {
    prepararAnalise().then(base => {
      abrirAnalise(); consultarAnalise(base)
      cy.get('form[aria-label="Filtros de vendas"]').within(() => { fill({ inicio: '2026-08-01', fim: '2026-02-01' }); submit('Aplicar filtros') })
      cy.contains('[role="alert"]', 'A data final não pode ser anterior à inicial.').should('be.visible')
      cy.get('form[aria-label="Filtros de vendas"]').within(() => { fill({ inicio: '2025-11-01', fim: '2025-11-02' }); submit('Aplicar filtros') })
      cy.contains('[role="alert"]', 'Selecione um intervalo de 1 a 24 meses.').should('be.visible')
      cy.get('form[aria-label="Filtros de vendas"]').within(() => { fill({ inicio: base.inicio, fim: base.fim }); cy.contains('button', 'Limpar categorias').click(); submit('Aplicar filtros') })
      cy.contains('[role="alert"]', 'Selecione ao menos uma categoria.').should('be.visible')
      cy.get('.sales-chart').should('not.exist')
    })
  })
  it('[RNF0011] mede a primeira consulta do gráfico e novas consultas de uma e várias categorias em até um segundo', () => {
    prepararAnalise().then(base => {
      cy.intercept('GET', '**/api/analises/vendas?*').as('primeiraAnalise')
      selectProfile('ADMIN', '/admin/analises')
      cy.wait('@primeiraAnalise').then(({ response, request }) => {
        expect(response?.statusCode).to.eq(200)
        cy.contains('h2', 'Vendas entregues por categoria').should('be.visible').then(() => conferirTempo(request.url))
      })
      cy.contains('h2', 'Vendas entregues por categoria').should('be.visible')
      consultarAnalise(base, [0, 1, 2], '2025-11-01', '2026-04-30')
      consultarAnalise(base, [0, 1, 3, 4], '2026-01-01', '2026-06-30')
      consultarAnalise(base, [2, 3], '2026-03-01', '2026-08-31')
    })
  })
})
