import { abrirAnalise, conferirBloqueio, consultarAnalise, prepararAnalise } from '../../support/analise'

describe('Análise 03 — acesso pelo perfil local, sem login', () => {
  it('[RF0055][Critério b] permite ao Admin abrir o gráfico pelo menu e consultar dados reais', () => {
    prepararAnalise().then(base => { abrirAnalise(true); consultarAnalise(base, [0, 2, 3], '2025-11-01', '2026-04-30') })
  })
  it('[RF0055][Critério b] nega ao cliente e ao visitante a URL direta e a API com HTTP 403', () => {
    prepararAnalise().then(base => { conferirBloqueio(base) })
  })
})
