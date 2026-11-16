import { selectProfile, submit } from '../../support/data'
import { abrirFinalizacao, finalizarPedido, iniciarCarrinho, prepararPedido, usarCupons, type BasePedido } from '../../support/pedido'
import { aguardarPagamento, conferirEstoque } from '../../support/vendas'
import type { Cupom } from '../../../src/services/vendaService'

describe('Vendas 13 — liberação segura do crédito excedente', () => {
  it('[RN0028][RN0036][RN0037] bloqueia crédito pendente; cancelar devolve só os cupons originais', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base); abrirFinalizacao(); usarCupons(base, [3, 4])
      finalizarPedido(base).then(pedido => {
        expect(pedido.creditStatus).to.eq('Aguardando aprovação')
        // Mantém o pagamento pendente durante o teste
        cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'pagamento', valor: 120, referenciaId: pedido.id })
        cy.contains('[role="alert"]', 'O crédito só pode ser utilizado após a aprovação').should('be.visible')
        selectProfile(base.cliente.id, '/cupons')
        cy.contains('article', pedido.creditCouponCode!).should('contain', 'Aguardando aprovação')
        cy.request<Cupom[]>(`/api/clientes/${base.cliente.id}/cupons`).then(({ body }) => {
          const credito = body.find(c => c.code === pedido.creditCouponCode)!
          iniciarCarrinho(base); abrirFinalizacao()
          cy.contains('label.option-card', pedido.creditCouponCode!).should('not.exist')
          cy.request(`/api/clientes/${base.cliente.id}/enderecos`).then(({ body: enderecos }) => {
            cy.request({ method: 'POST', url: `/api/clientes/${base.cliente.id}/checkout/orcamento`,
              body: { enderecoId: enderecos[0].id, cupomIds: [credito.id] }, failOnStatusCode: false }).its('status').should('eq', 409)
          })
          // Remove a nova reserva antes do cancelamento
          cy.contains('a', 'Alterar itens do carrinho').click()
          cy.contains('.cart-line', base.produtos[0].nome).contains('button', 'Remover').click()
          cy.contains('Seu carrinho está vazio.').should('be.visible')
          selectProfile(base.cliente.id, '/pedidos')
          cy.get(`article[data-order-id="${pedido.id}"]`).contains('button', 'Cancelar pedido').click()
          cy.get('form.mock-editor').within(() => submit('Cancelar pedido'))
          cy.get(`article[data-order-id="${pedido.id}"]`).should('contain', 'CANCELADO')
          selectProfile(base.cliente.id, '/cupons')
          cy.contains('article', pedido.creditCouponCode!).should('contain', 'Invalidado')
          cy.request<Cupom[]>(`/api/clientes/${base.cliente.id}/cupons`).then(({ body: depois }) => {
            expect(depois.find(c => c.id === credito.id)?.status).to.eq('Invalidado')
            for (const original of [base.cupons[3], base.cupons[4]])
              expect(depois.find(c => c.id === original.id)?.status).to.eq('Disponível')
          })
          conferirEstoque(base, pedido, false)
        })
      })
    })
  })

  it('[RN0036][RN0037][RN0038] invalida o crédito excedente após reprovação automática sem baixar estoque', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base); abrirFinalizacao(); usarCupons(base, [3, 4])
      finalizarPedido(base).then(pedido => {
        cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'pagamento', valor: 120, referenciaId: pedido.id })
        cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'cupom', valor: 0, referenciaId: base.cupons[3].id })
        cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'pagamento', valor: 0, referenciaId: pedido.id })
        aguardarPagamento(pedido, 'REPROVADA')
        conferirEstoque(base, pedido, false)
        selectProfile(base.cliente.id, '/cupons')
        cy.contains('article', pedido.creditCouponCode!).should('contain', 'Invalidado')
        cy.request<Cupom[]>(`/api/clientes/${base.cliente.id}/cupons`).then(({ body }) => {
          expect(body.find(c => c.id === base.cupons[3].id)?.status).to.eq('Expirado')
          expect(body.find(c => c.id === base.cupons[4].id)?.status).to.eq('Disponível')
        })
      })
    })
  })

  it('[RF0037][RN0036][RN0038] libera e usa a diferença em nova compra só após aprovação da origem', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base); abrirFinalizacao(); usarCupons(base, [3, 4])
      finalizarPedido(base).then(pedido => {
        aguardarPagamento(pedido)
        selectProfile(base.cliente.id, '/cupons')
        cy.contains('article', pedido.creditCouponCode!).should('contain', 'Disponível')
        const atual: BasePedido = { ...base, produtos: [] }
        for (const p of base.produtos)
          cy.request('/api/produtos/' + p.id).then(({ body }) => { atual.produtos.push(body) })
        cy.then(() => {
          iniciarCarrinho(atual); abrirFinalizacao()
          cy.contains('label.option-card', pedido.creditCouponCode!).find('input').check()
          cy.wait('@orcamento').its('response.statusCode').should('eq', 200)
          finalizarPedido(atual).then(segunda => {
            expect(segunda.id).not.to.eq(pedido.id)
            expect(segunda.desconto).to.eq(pedido.creditValue)
            aguardarPagamento(segunda)
            conferirEstoque(atual, segunda, true)
            selectProfile(base.cliente.id, '/cupons')
            cy.contains('article', pedido.creditCouponCode!).should('contain', 'Utilizado')
          })
        })
      })
    })
  })
})
