import { conferirCupomTroca, autorizarTroca, despacharTroca, prepararVenda, receberTroca, reutilizarCupomTroca, solicitarTroca } from '../../support/vendas'

describe('Vendas 12 — uso do crédito efetivamente gerado pela troca', () => {
  it('[RF0037][RF0045][RN0037] usa o crédito da troca em nova compra e impede reutilizar o mesmo cupom', () => {
    prepararVenda('ENTREGUE').then(({ base, pedido }) => {
      solicitarTroca(base, pedido).then(troca => {
        autorizarTroca(troca)
        despacharTroca(base, troca)
        receberTroca(troca)
        conferirCupomTroca(base, pedido, troca)
        reutilizarCupomTroca(base, troca)
      })
    })
  })
})
