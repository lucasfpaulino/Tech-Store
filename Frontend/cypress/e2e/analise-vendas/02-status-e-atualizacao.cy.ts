import { abrirAnalise, conferirEstadosDaMassa, consultarAnalise, entregarPelaTela, prepararAnalise, registrarEntregaNaBase } from '../../support/analise'

describe('Análise 02 — critério específico da entrega: somente ENTREGUE', () => {
  it('[RF0055] não contabiliza APROVADA, EM TRANSPORTE, EM PROCESSAMENTO, REPROVADA e CANCELADO', () => {
    prepararAnalise().then(base => {
      conferirEstadosDaMassa(base)
      abrirAnalise(); consultarAnalise(base, [0, 1, 2])
    })
  })
  it('[RF0055][RF0040] confirma entrega pela gestão e inclui a venda na próxima consulta, persistindo após recarregar', () => {
    prepararAnalise().then(base => {
      abrirAnalise(); consultarAnalise(base, [0, 1, 3, 4], base.inicio, base.fimAtual); entregarPelaTela(base); consultarAnalise(base, [0, 1, 3, 4], base.inicio, base.fimAtual)
      cy.reload(); cy.contains('h2', 'Vendas entregues por categoria').should('be.visible'); consultarAnalise(base, [0, 1, 3, 4], base.inicio, base.fimAtual)
    })
  })
  it('[RF0055] repetir os mesmos filtros consulta novamente o servidor após alteração externa, sem cache desatualizado', () => {
    prepararAnalise().then(base => {
      abrirAnalise(); consultarAnalise(base, [0, 2])
      // Prepara a alteração externa
      cy.request('PATCH', `/api/pedidos/${base.pendente.id}/status`, { status: 'ENTREGUE' }).its('body.status').should('eq', 'ENTREGUE')
      cy.then(() => registrarEntregaNaBase(base))
      consultarAnalise(base, [0, 2])
    })
  })
})
