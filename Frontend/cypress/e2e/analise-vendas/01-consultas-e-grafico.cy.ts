import { abrirAnalise, consultarAnalise, prepararAnalise } from '../../support/analise'

describe('Análise 01 — consultas, comparação e gráfico', () => {
  it('[RF0055] consulta uma categoria e confere cada soma mensal com as vendas ENTREGUE da base', () => {
    prepararAnalise().then(base => { abrirAnalise(); consultarAnalise(base, [0], '2026-01-01', '2026-03-31') })
  })
  it('[RF0055][RNF0043] consulta 3, depois 4 e depois 2 categorias em 2025/2026, sem overflow desktop', () => {
    prepararAnalise().then(base => {
      abrirAnalise()
      consultarAnalise(base, [0, 1, 2], '2025-11-01', '2026-04-30')
      consultarAnalise(base, [0, 1, 3, 4], '2026-01-01', '2026-06-30')
      for (const width of [1680, 1280]) {
        cy.viewport(width, 1050)
        cy.document().then(doc => expect(doc.documentElement.scrollWidth).to.be.at.most(width))
        cy.get('.sales-chart canvas').should('be.visible')
        cy.get('.sales-chart').should(chart => {
          const canvas = chart[0].querySelector('canvas')!
          expect(canvas.getBoundingClientRect().width, 'canvas acompanha a largura do painel após redimensionar').to.be.closeTo(chart[0].getBoundingClientRect().width, 1)
        })
        cy.screenshot('analise-desktop-' + width, { capture: 'viewport' })
      }
      cy.viewport(1680, 1050)
      consultarAnalise(base, [2, 3], '2026-03-01', '2026-08-31')
    })
  })
  it('[RF0055][RF0056] altera separadamente data inicial e final e atualiza meses e valores do gráfico', () => {
    prepararAnalise().then(base => {
      abrirAnalise(); consultarAnalise(base, [1, 4], '2026-01-01', '2026-03-31')
      consultarAnalise(base, [1, 4], '2026-02-01', '2026-03-31')
      consultarAnalise(base, [1, 4], '2026-02-01', '2026-06-30')
    })
  })
})
