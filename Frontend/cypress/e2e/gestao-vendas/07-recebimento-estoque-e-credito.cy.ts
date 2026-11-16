import { conferirCupomTroca, conferirEstoque, autorizarTroca, despacharTroca, encerrarTroca, prepararVenda, receberTroca, solicitarTroca } from '../../support/vendas'

describe('Vendas 07 — despacho da troca, recebimento, estoque e cupom', () => {
  it('[RF0044][RF0045][RF0054][RN0042] recebe, conclui TROCADO e gera estoque e cupom uma única vez', () => {
    prepararVenda('ENTREGUE').then(({ base, pedido }) => {
      solicitarTroca(base, pedido).then(troca => {
        autorizarTroca(troca)
        despacharTroca(base, troca)
        receberTroca(troca)
        cy.request('/api/pedidos/' + pedido.id).its('body.status').should('eq', 'TROCADO')
        const devolvidos = { [pedido.items[0].productId]: 1 }
        conferirEstoque(base, pedido, true, devolvidos)
        // Repetição de rede não pode gerar um segundo crédito ou uma segunda entrada.
        cy.request('PATCH', `/api/trocas/${troca.id}/status`, { status: 'ITEM RECEBIDO', reentradaEstoque: true })
        encerrarTroca(troca)
        conferirCupomTroca(base, pedido, troca)
        conferirEstoque(base, pedido, true, devolvidos)
      })
    })
  })
})
