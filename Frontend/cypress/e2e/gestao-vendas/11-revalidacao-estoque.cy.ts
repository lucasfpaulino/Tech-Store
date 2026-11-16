import { abrirFinalizacao, iniciarCarrinho, prepararPedido } from '../../support/pedido'
import type { Quote } from '../../../src/services/vendaService'

describe('Vendas 11 — revalidação de estoque entre carrinho e compra', () => {
  it('[RN0032] reduz quantidade após mudança externa do estoque, recalcula e avisa antes de finalizar', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base, true)
      // Simula uma mudança externa no estoque
      cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'estoque', valor: 1, referenciaId: base.produtos[0].id })
        .its('aplicado').should('eq', true)
      // Aguarda o aviso na tela
      abrirFinalizacao()
      cy.contains('[role="alert"]', 'A quantidade de ' + base.produtos[0].nome).should('contain', 'foi ajustada para 1')
      cy.contains('[data-testid="checkout-item"]', base.produtos[0].nome).should('contain', '1 ×')
      cy.get('@orcamento').then(intercept => {
        const quote = (intercept as unknown as { response: { body: Quote } }).response.body
        expect(quote.items.find(i => i.productId === base.produtos[0].id)?.quantity).to.eq(1)
        expect(quote.subtotal).to.eq(base.produtos[0].preco + base.produtos[1].preco)
        expect(quote.frete).to.eq(16.90)
      })
      cy.request('/api/produtos/' + base.produtos[0].id).then(({ body }) => {
        expect(body.quantidade).to.eq(1)
        expect(body.reservado).to.eq(1)
      })
    })
  })

  it('[RN0032] remove produto que ficou indisponível, alerta o cliente e bloqueia finalizar carrinho vazio', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base)
      cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'estoque', valor: 0, referenciaId: base.produtos[0].id })
      cy.reload()
      cy.contains('[role="alert"]', base.produtos[0].nome).should('contain', 'Produto indisponível')
      cy.get('.cart-line').should('not.exist')
      cy.contains('a', /^Finalizar compra$/).should('have.attr', 'aria-disabled', 'true')
      cy.request('/api/clientes/' + base.cliente.id + '/carrinho').its('body').should('have.length', 0)
      cy.request('/api/produtos/' + base.produtos[0].id).its('body.reservado').should('eq', 0)
    })
  })
})
