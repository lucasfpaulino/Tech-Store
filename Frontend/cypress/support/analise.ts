import { fill, selectProfile, submit } from './data'
import type { AnaliseVendas } from '../../src/services/analiseService'

export type BaseAnalise = {
  novosPedidos: number; clienteId: string; inicio: string; fim: string; fimAtual: string; meses: string[]
  categorias: { id: string; nome: string; valores: number[] }[]
  pendente: { id: string; numero: number; mes: string; valor: number }
}
const reais = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
export const prepararAnalise = () => cy.task<BaseAnalise>('prepararAnalise', null, { timeout: 65000 })

export function conferirEstadosDaMassa(base: BaseAnalise) {
  return cy.request('/api/pedidos?clienteId=' + base.clienteId).then(({ body }) => {
    expect(body, '71 pedidos históricos persistidos para esta execução').to.have.length(71)
    expect(body.map((pedido: { status: string }) => pedido.status)).to.include.members([
      'APROVADA', 'EM TRANSPORTE', 'EM PROCESSAMENTO', 'REPROVADA', 'CANCELADO', 'ENTREGUE',
    ])
  })
}

export function registrarEntregaNaBase(base: BaseAnalise) {
  const month = base.meses.indexOf(base.pendente.mes)
  expect(month, 'mês original da compra presente no histórico').to.be.at.least(0)
  base.categorias[0].valores[month] = Number((base.categorias[0].valores[month] + base.pendente.valor).toFixed(2))
}

export function conferirTempo(url: string) {
  // Mede o tempo real da requisição
  return cy.window().then(win => {
    const timings = win.performance.getEntriesByName(url)
    const timing = timings[timings.length - 1]
    expect(timing, 'requisição registrada pelo navegador').not.to.eq(undefined)
    expect(timing.duration, '[RNF0011] consulta completa em até 1 segundo').to.be.at.most(1000)
    cy.log('[RNF0011] ' + timing.duration.toFixed(1) + ' ms')
    return cy.task('registrarTempoAnalise', { url, duracaoMs: timing.duration })
  })
}

export function abrirAnalise(peloMenu = false) {
  if (peloMenu) {
    cy.visit('/perfis')
    cy.contains('a.profile-card', 'Administrador').click()
    cy.get('.admin-sidebar').contains('a', 'Análise de vendas').click()
  } else selectProfile('ADMIN', '/admin/analises')
  cy.contains('h1', 'Evolução das vendas').should('be.visible')
  cy.contains('h2', 'Vendas entregues por categoria').should('be.visible')
}

export function conferirValores(base: BaseAnalise, data: AnaliseVendas, indices: number[], inicio: string, fim: string) {
  const months = base.meses.filter(m => m >= inicio.slice(0, 7) && m <= fim.slice(0, 7))
  expect(data.inicio).to.eq(inicio); expect(data.fim).to.eq(fim)
  expect(data.meses, 'agrupamento mensal do período consultado').to.deep.eq(months)
  expect(data.series).to.have.length(indices.length)
  for (const index of indices) {
    const cat = base.categorias[index], serie = data.series.find(s => s.categoriaId === cat.id)!
    expect(serie, cat.nome + ': categoria selecionada').not.to.eq(undefined)
    expect(serie.nome, 'nome da categoria preservado na resposta').to.eq(cat.nome)
    expect(serie.valores, 'soma independente dos itens ENTREGUE no PostgreSQL').to.deep.eq(months.map(m => cat.valores[base.meses.indexOf(m)]))
  }
}

export function consultarAnalise(base: BaseAnalise, indices = [0], inicio = base.inicio, fim = base.fim) {
  const alias = 'consultaGrafico' + Cypress._.uniqueId()
  const categorias = indices.map(index => base.categorias[index].id).sort().join(',')
  cy.intercept({ method: 'GET', pathname: '/api/analises/vendas', query: { inicio, fim, categorias } }).as(alias)
  cy.get('form[aria-label="Filtros de vendas"]').within(() => {
    fill({ inicio, fim }); cy.contains('button', 'Limpar categorias').click()
    for (const index of indices) cy.get(`[name="categoria-${base.categorias[index].id}"]`).check()
    submit('Aplicar filtros')
  })
  return cy.wait(`@${alias}`).then(({ response, request }) => {
    expect(request.headers['x-perfil']).to.eq('ADMIN')
    expect(response?.statusCode).to.eq(200)
    const data = response!.body as AnaliseVendas
    conferirValores(base, data, indices, inicio, fim)
    cy.get('section[aria-label="Resultado da análise de vendas"]').should('have.attr', 'aria-busy', 'false')
    cy.get('details.sales-result__data').then(details => { if (!details[0].hasAttribute('open')) cy.wrap(details).find('summary').click() })
    cy.get('table[aria-label="Dados de vendas"] thead th').should('have.length', indices.length + 1)
    data.series.forEach((serie, column) => cy.get('table[aria-label="Dados de vendas"] thead th').eq(column + 1).should('have.text', serie.nome))
    cy.get('table[aria-label="Dados de vendas"] tbody tr').should('have.length', data.meses.length).each((row, n) => {
      cy.wrap(row).find('th').should('have.text', data.meses[n].slice(5) + '/' + data.meses[n].slice(0, 4))
      data.series.forEach((serie, column) => cy.wrap(row).find('td').eq(column).should('have.text', reais(serie.valores[n])))
    })
    cy.get('[role="img"][aria-label*="Gráfico de linhas"]').should('be.visible').find('canvas').should('be.visible')
    conferirTempo(request.url)
    cy.get('.sales-result__heading').scrollIntoView({ duration: 120, offset: { top: -90, left: 0 } })
    return cy.then(() => data)
  })
}

export function entregarPelaTela(base: BaseAnalise) {
  cy.get('.admin-sidebar a[href="/admin/pedidos"]').click()
  cy.get('.table-search input').type(String(base.pendente.numero))
  cy.intercept('PATCH', `**/api/pedidos/${base.pendente.id}/status`).as('confirmarEntregaAnalise')
  cy.get(`tr[data-record-id="${base.pendente.id}"]`).should('contain', 'EM TRANSPORTE').contains('button', 'Alterar status').click()
  cy.get('form[aria-label="Alterar status do pedido"]').within(() => { fill({ status: 'ENTREGUE' }); submit() })
  cy.wait('@confirmarEntregaAnalise').its('response.body.status').should('eq', 'ENTREGUE')
  cy.get(`tr[data-record-id="${base.pendente.id}"]`).should('contain', 'ENTREGUE')
  // Mantém o mês original da compra
  cy.then(() => registrarEntregaNaBase(base))
  cy.get('.admin-sidebar').contains('a', 'Análise de vendas').click()
  cy.contains('h2', 'Vendas entregues por categoria').should('be.visible')
}

export function conferirBloqueio(base: BaseAnalise) {
  const url = '/api/analises/vendas?' + new URLSearchParams({ inicio: base.inicio, fim: base.fim, categorias: base.categorias[0].id })
  for (const profile of [base.clienteId, '']) {
    selectProfile(profile, '/admin/analises')
    cy.contains('[role="alert"]', 'Acesso restrito ao perfil administrador.').should('be.visible')
    cy.get('.sales-chart, form[aria-label="Filtros de vendas"]').should('not.exist')
    cy.request({ url, headers: profile ? { 'X-Perfil': profile } : {}, failOnStatusCode: false }).then(({ status, body }) => {
      expect(status).to.eq(403); expect(body.message).to.contain('somente para o administrador')
    })
  }
}
