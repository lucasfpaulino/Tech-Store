import { apiCard, selectProfile } from '../../support/data'
import { abrirFinalizacao, finalizarPedido, iniciarCarrinho, prepararPedido, usarCupons } from '../../support/pedido'
import { conferirEstoque, aguardarPagamento } from '../../support/vendas'

describe('Vendas 04 — aprovação e reprovação simuladas', () => {
  it('[RF0053][RN0028][RN0037][RN0038] aprova automaticamente um cartão e baixa estoque uma única vez', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base); abrirFinalizacao()
      finalizarPedido(base).then(pedido => {
        expect(pedido.payments).to.have.length(1)
        aguardarPagamento(pedido)
        conferirEstoque(base, pedido, true)
        // Confere a idempotência
        cy.request('POST', `/api/pedidos/${pedido.id}/pagamento`).its('body.status').should('eq', 'APROVADA')
        conferirEstoque(base, pedido, true)
      })
    })
  })
  it('[RF0038][RN0028][RN0037][RN0038] compra pela tela, reprova cartão e devolve cupom e reserva sem baixa', () => {
    prepararPedido().then(base => {
      apiCard(base.cliente.id, '4000000000000002').then(cartao => {
        iniciarCarrinho(base); abrirFinalizacao(); usarCupons(base, [0])
        cy.get('input[name^="cartao-"]:checked').uncheck()
        cy.get(`input[name="cartao-${cartao.id}"]`).check()
        finalizarPedido(base).then(pedido => {
          expect(pedido.payments).to.have.length(1)
          expect(pedido.payments![0].lastDigits).to.eq('0002')
          expect(pedido.couponCodes).to.deep.eq([base.cupons[0].codigo])
          aguardarPagamento(pedido, 'REPROVADA')
          cy.contains('[role="alert"]', 'Pagamento reprovado.').should('be.visible')
          conferirEstoque(base, pedido, false)
          selectProfile(base.cliente.id, '/cupons')
          cy.contains('article', base.cupons[0].codigo).should('contain', 'Disponível')
          cy.request(`/api/clientes/${base.cliente.id}/cupons`).then(({ body }) => {
            expect(body.find((c: { id: string; status: string }) => c.id === base.cupons[0].id)?.status).to.eq('Disponível')
          })
          selectProfile(base.cliente.id, '/pedidos/' + pedido.id)
          cy.contains('.status', 'REPROVADA').should('be.visible')
          cy.screenshot('compra-reprovada-sem-baixa', { capture: 'viewport' })
        })
      })
    })
  })
  it('[RN0028][RN0037][RN0038] revalida cupom vencido após finalizar e reprova sem baixar estoque', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base); abrirFinalizacao(); usarCupons(base, [0])
      finalizarPedido(base).then(pedido => {
        cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'pagamento', valor: 30, referenciaId: pedido.id })
        cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'cupom', valor: 0, referenciaId: base.cupons[0].id })
          .its('aplicado').should('eq', true)
        cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'pagamento', valor: 0, referenciaId: pedido.id })
        aguardarPagamento(pedido, 'REPROVADA')
        conferirEstoque(base, pedido, false)
        cy.request('/api/clientes/' + base.cliente.id + '/cupons').then(({ body }) => {
          expect(body.find((c: { id: string; status: string }) => c.id === base.cupons[0].id).status).to.eq('Expirado')
        })
      })
    })
  })
})
