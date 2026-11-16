import { describe, expect, it } from 'vitest'
import { formatSalesCurrency, salesChartOptions } from './salesChartOptions'

describe('RF0055 / RNF0043–RNF0046 — opções reais do gráfico de linhas', () => {
  const data = { inicio: '2026-06-01', fim: '2026-08-31', meses: ['2026-06', '2026-07', '2026-08'], criterio: 'ENTREGUE',
    series: [{ categoriaId: 'gpu', nome: 'Placas de vídeo', valores: [2500, 1500, 800] }, { categoriaId: 'ram', nome: 'Memórias RAM', valores: [400, 0, 750] }] }
  it('usa linhas por categoria, meses em mês/ano e mantém os pontos de valor zero', () => {
    const options = salesChartOptions(data)
    expect(options.xAxis).toMatchObject({ type: 'category', data: ['06/2026', '07/2026', '08/2026'] })
    expect(options.series).toMatchObject([{ type: 'line', name: 'Placas de vídeo', data: [2500, 1500, 800] }, { type: 'line', name: 'Memórias RAM', data: [400, 0, 750] }])
    expect(options.yAxis).toMatchObject({ type: 'value', name: 'Vendas (R$)', min: 0, axisLabel: { formatter: formatSalesCurrency } })
  })
  it('usa cores distintas, legenda inferior e tooltip em reais sem substituir os valores da API', () => {
    const options = salesChartOptions(data, 2)
    expect(options.legend).toMatchObject({ bottom: 0 })
    expect(options.tooltip).toMatchObject({ trigger: 'axis', confine: true })
    expect(options.textStyle).toMatchObject({ fontSize: 14 })
    expect(new Set(options.color as string[]).size).to.eq((options.color as string[]).length)
    expect(formatSalesCurrency(20000)).to.eq('R$\u00a020.000,00')
    expect(data.series[1].valores).to.deep.eq([400, 0, 750])
  })
})
