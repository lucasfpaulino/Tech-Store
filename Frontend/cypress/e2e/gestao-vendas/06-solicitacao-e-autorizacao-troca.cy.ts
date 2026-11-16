import { conferirEstoque, conferirNotificacao, autorizarTroca, prepararVenda, solicitarTroca, despacharTroca, receberTroca, conferirCupomTroca } from '../../support/vendas'

describe('Vendas 06 — troca integral, troca parcial e autorização', () => {
  it('[RF0041][RF0042][RF0043][RN0041][RN0043][RN0046] solicita troca integral, autoriza e notifica o cliente', () => {
    prepararVenda('ENTREGUE').then(({ base, pedido }) => {
      solicitarTroca(base, pedido).then(troca => {
        cy.request('/api/pedidos/' + pedido.id).its('body.status').should('eq', 'EM TROCA')
        autorizarTroca(troca)
        cy.request('/api/pedidos/' + pedido.id).its('body.status').should('eq', 'TROCA AUTORIZADA')
        conferirNotificacao(base)
        conferirEstoque(base, pedido, true)
      })
    })
  })
  it('[RF0041][RF0044][RF0045][RN0041][RN0042] troca uma unidade, gera crédito e preserva as demais do pedido', () => {
    prepararVenda('ENTREGUE', false, true).then(({ base, pedido }) => {
      solicitarTroca(base, pedido, base.produtos[0].id, 1).then(troca => {
        cy.request('/api/pedidos/' + pedido.id).its('body.status').should('eq', 'ENTREGUE')
        autorizarTroca(troca)
        conferirNotificacao(base)
        despacharTroca(base, troca)
        receberTroca(troca)
        conferirEstoque(base, pedido, true, { [base.produtos[0].id]: 1 })
        conferirCupomTroca(base, pedido, troca)
        cy.request('/api/pedidos/' + pedido.id).then(({ body }) => {
          expect(body.status, 'as outras unidades não foram trocadas').to.eq('ENTREGUE')
          expect(body.items).to.have.length(2)
        })
      })
    })
  })
})
