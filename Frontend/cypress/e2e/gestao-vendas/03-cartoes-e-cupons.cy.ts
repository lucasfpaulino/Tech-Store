import { abrirFinalizacao, conferirCredito, doisCartoes, finalizarPedido, iniciarCarrinho, prepararPedido, usarCupons } from '../../support/pedido'
import { apiCoupon, submit } from '../../support/data'
import { conferirEstoque, aguardarPagamento } from '../../support/vendas'
import type { Cupom } from '../../../src/services/vendaService'

describe('Vendas 03 — divisão de pagamento e cupons', () => {
  it('[RF0036][RN0034] rejeita R$ 5,00 sem cupons e aprova dois cartões com mínimo de R$ 10,00', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base); abrirFinalizacao(); doisCartoes()
      const total = Number((base.produtos[0].preco + 14.90).toFixed(2))
      cy.get('[aria-label="Valor no cartão final 1111"]').clear().type('5')
      cy.get('[aria-label="Valor no cartão final 4444"]').clear().type(String(total - 5))
      submit('Finalizar compra')
      cy.contains('[role="alert"]', 'Cada cartão deve pagar pelo menos').should('be.visible')
      cy.request('/api/pedidos?clienteId=' + base.cliente.id).its('body').should('have.length', 0)
      cy.get('[aria-label="Valor no cartão final 1111"]').clear().type('10')
      cy.get('[aria-label="Valor no cartão final 4444"]').clear().type(String(total - 10))
      finalizarPedido(base).then(pedido => {
        expect(pedido.payments).to.have.length(2)
        pedido.payments!.forEach(p => expect(p.amount).to.be.at.least(10))
        expect(pedido.payments!.reduce((s, p) => s + p.amount, 0)).to.eq(pedido.total - pedido.desconto)
        aguardarPagamento(pedido)
        conferirEstoque(base, pedido, true)
      })
    })
  })
  it('[RF0037][RN0033][RN0035] mantém um promocional, combina cupom de troca e paga R$ 5,00 no cartão', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base); abrirFinalizacao(); usarCupons(base, [1, 0, 2])
      cy.contains('label.option-card', base.cupons[1].codigo).find('input').should('not.be.checked')
      cy.get('.payment-split input').should('have.value', '5')
      finalizarPedido(base).then(pedido => {
        expect(pedido.couponCodes).to.have.length(2).and.include(base.cupons[0].codigo).and.include(base.cupons[2].codigo)
        expect(pedido.desconto).to.eq(base.cupons[0].valor + base.cupons[2].valor)
        expect(pedido.payments![0].amount).to.eq(5)
        aguardarPagamento(pedido)
        conferirEstoque(base, pedido, true)
      })
    })
  })
  it('[RF0037][RN0035] usa o valor integral do promocional e aprova o saldo de R$ 5,00 no cartão', () => {
    prepararPedido().then(base => {
      const desconto = Number((base.produtos[0].preco + 14.90 - 5).toFixed(2))
      apiCoupon(base.cliente.id, desconto, 'Promocional').then(cupom => {
        iniciarCarrinho(base); abrirFinalizacao()
        cy.contains('label.option-card', cupom.codigo).find('input').check()
        cy.wait('@orcamento').its('response.statusCode').should('eq', 200)
        cy.get('.payment-split input').should('have.value', '5')
        finalizarPedido(base).then(pedido => {
          expect(pedido.couponCodes).to.deep.eq([cupom.codigo])
          expect(pedido.desconto).to.eq(desconto)
          expect(pedido.payments).to.have.length(1)
          expect(pedido.payments![0].amount).to.eq(5)
          aguardarPagamento(pedido)
          conferirEstoque(base, pedido, true)
        })
      })
    })
  })
  it('[RF0037][RN0036] paga só com cupons excedentes e libera a diferença após aprovação', () => {
    prepararPedido().then(base => {
      cy.request<Cupom[]>(`/api/clientes/${base.cliente.id}/cupons`).then(({ body }) => {
        for (const original of [base.cupons[3], base.cupons[4]]) {
          const cupom = body.find(c => c.id === original.id)!
          expect(cupom.type, 'cenário mínimo 4: cupom de troca, não promocional').to.eq('Cupom de troca')
          expect(cupom.value).to.eq(original.valor)
          expect(cupom.status).to.eq('Disponível')
        }
      })
      iniciarCarrinho(base); abrirFinalizacao(); usarCupons(base, [3, 4])
      cy.contains('Os cupons cobrem a compra.').should('be.visible')
      finalizarPedido(base).then(pedido => {
        expect(pedido.payments).to.have.length(0)
        expect(pedido.couponCodes).to.have.length(2).and.include(base.cupons[3].codigo).and.include(base.cupons[4].codigo)
        expect(pedido.creditValue).to.eq(Number((110 - pedido.total).toFixed(2)))
        aguardarPagamento(pedido)
        conferirEstoque(base, pedido, true)
        conferirCredito(pedido)
      })
    })
  })
})
