import { apiCoupon, apiCustomer, selectProfile, submit } from '../../support/data'
import { abrirFinalizacao, iniciarCarrinho, prepararPedido, usarCupons } from '../../support/pedido'
import { alterarStatusAdmin, autorizarTroca, conferirEstoque, conferirNotificacao, prepararVenda, receberTroca, solicitarTroca } from '../../support/vendas'

describe('Vendas 08 — limites e operações indevidas', () => {
  it('[RF0042][RF0044][RN0042] impede negar troca e conclui TROCADO no recebimento sem exigir despacho', () => {
    prepararVenda('ENTREGUE').then(({ base, pedido }) => {
      solicitarTroca(base, pedido).then(troca => {
        selectProfile('ADMIN', '/admin/trocas')
        cy.contains('tbody tr', troca.id).should('contain', 'EM TROCA').contains('button', 'Autorizar troca').click()
        cy.get('form.mock-editor').within(() => {
          cy.get('[name="nextStatus"] option').should('have.length', 1).and('contain', 'TROCA AUTORIZADA')
          cy.contains('button', 'Cancelar').click()
        })
        cy.request({ method: 'PATCH', url: `/api/trocas/${troca.id}/status`, body: { status: 'TROCA NEGADA' }, failOnStatusCode: false }).its('status').should('eq', 400)
        autorizarTroca(troca)
        conferirNotificacao(base)
        receberTroca(troca)
        cy.contains('tbody tr', troca.id).should('contain', 'TROCADO')
        cy.contains('button', 'Processar troca').should('not.exist')
        conferirEstoque(base, pedido, true, { [troca.productId!]: troca.quantity! })
      })
    })
  })
  it('[RF0038][RN0034] impede finalizar com cartão abaixo do mínimo ou soma diferente do total', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base); abrirFinalizacao()
      cy.get('input[name^="cartao-"]').check()
      cy.get('[aria-label="Valor no cartão final 1111"]').clear().type('5')
      cy.get('[aria-label="Valor no cartão final 4444"]').clear().type(String(base.produtos[0].preco + 14.90 - 5))
      submit('Finalizar compra')
      cy.contains('[role="alert"]', 'Cada cartão deve pagar pelo menos').should('be.visible')
      cy.get('[aria-label="Valor no cartão final 1111"]').clear().type('20')
      submit('Finalizar compra')
      cy.contains('[role="alert"]', 'A soma dos cartões').should('be.visible')
      cy.request('/api/pedidos?clienteId=' + base.cliente.id).its('body').should('have.length', 0)
    })
  })
  it('[RN0039][RN0043] bloqueia transporte antes da aprovação e troca antes de ENTREGUE na tela e API', () => {
    prepararVenda().then(({ base, pedido }) => {
      cy.task('condicionarVenda', { clienteId: base.cliente.id, operacao: 'pagamento', valor: 60, referenciaId: pedido.id })
      selectProfile(base.cliente.id, '/pedidos')
      cy.get(`article[data-order-id="${pedido.id}"]`).within(() => {
        cy.contains('a', 'Solicitar troca').should('not.exist')
        cy.contains('button', 'Confirmar recebimento').should('not.exist')
      })
      cy.visit('/trocas?pedido=' + pedido.id)
      cy.get('.exchange-form').within(() => {
        cy.contains('label', 'Pedido').find(`option[value="${pedido.id}"]`).should('not.exist')
        cy.contains('button', 'Solicitar troca').should('be.disabled')
      })
      selectProfile('ADMIN', '/admin/pedidos')
      cy.get(`tbody tr[data-record-id="${pedido.id}"]`).contains('button', 'Alterar status').click()
      cy.get('form[aria-label="Alterar status do pedido"] [name="status"] option').should('not.contain.text', 'EM TRANSPORTE')
      cy.request({ method: 'PATCH', url: `/api/pedidos/${pedido.id}/status`, body: { status: 'EM TRANSPORTE' }, failOnStatusCode: false }).its('status').should('eq', 409)
      cy.request({ method: 'POST', url: `/api/clientes/${base.cliente.id}/trocas`, body: { orderId: pedido.id, productId: pedido.items[0].productId, quantity: 1, reason: 'Solicitação antes da entrega' }, failOnStatusCode: false }).its('status').should('eq', 409)
      cy.request('/api/trocas?clienteId=' + base.cliente.id).its('body').should('have.length', 0)
    })
  })
  it('[RN0033][RN0036] rejeita dois promocionais e cupons desnecessários além dos que cobrem a compra', () => {
    prepararPedido().then(base => {
      iniciarCarrinho(base); abrirFinalizacao(); usarCupons(base, [0, 1])
      cy.contains('label.option-card', base.cupons[0].codigo).find('input').should('not.be.checked')
      cy.request(`/api/clientes/${base.cliente.id}/enderecos`).then(({ body }) => {
        // Confere a validação do backend
        for (const cupomIds of [[base.cupons[0].id, base.cupons[1].id], [base.cupons[3].id, base.cupons[4].id, base.cupons[2].id]]) {
          cy.request({ method: 'POST', url: `/api/clientes/${base.cliente.id}/checkout/orcamento`, body: { enderecoId: body[0].id, cupomIds }, failOnStatusCode: false }).its('status').should('eq', 400)
        }
      })
      cy.request('/api/pedidos?clienteId=' + base.cliente.id).its('body').should('have.length', 0)
    })
  })
  it('[RF0037][RN0037] oculta cupom de outro cliente e rejeita cupom alheio ou inexistente na API', () => {
    prepararPedido().then(base => {
      apiCustomer().then(outro => apiCoupon(outro.id, 20).then(cupom => {
        iniciarCarrinho(base); abrirFinalizacao()
        cy.contains('label.option-card', cupom.codigo).should('not.exist')
        cy.request(`/api/clientes/${base.cliente.id}/enderecos`).then(({ body }) => {
          for (const id of [cupom.id, crypto.randomUUID()]) {
            cy.request({ method: 'POST', url: `/api/clientes/${base.cliente.id}/checkout/orcamento`, body: { enderecoId: body[0].id, cupomIds: [id] }, failOnStatusCode: false }).its('status').should('eq', 404)
          }
        })
        cy.request('/api/pedidos?clienteId=' + base.cliente.id).its('body').should('have.length', 0)
      }))
    })
  })

  it('[RF0041][RN0043] bloqueia troca também nos estados APROVADA e EM TRANSPORTE', () => {
    prepararVenda('APROVADA').then(({ base, pedido }) => {
      const conferirBloqueio = (status: 'APROVADA' | 'EM TRANSPORTE') => {
        selectProfile(base.cliente.id, '/pedidos')
        cy.get(`article[data-order-id="${pedido.id}"]`).should('contain', status)
          .contains('a', 'Solicitar troca').should('not.exist')
        cy.visit('/trocas?pedido=' + pedido.id)
        cy.get('.exchange-form').within(() => {
          cy.contains('label', 'Pedido').find(`option[value="${pedido.id}"]`).should('not.exist')
          cy.contains('button', 'Solicitar troca').should('be.disabled')
        })
        cy.request({ method: 'POST', url: `/api/clientes/${base.cliente.id}/trocas`,
          body: { orderId: pedido.id, productId: pedido.items[0].productId, quantity: 1, reason: 'Antes da entrega' },
          failOnStatusCode: false }).its('status').should('eq', 409)
      }
      conferirBloqueio('APROVADA')
      alterarStatusAdmin(pedido, 'EM TRANSPORTE')
      conferirBloqueio('EM TRANSPORTE')
      cy.request('/api/trocas?clienteId=' + base.cliente.id).its('body').should('have.length', 0)
    })
  })
})
