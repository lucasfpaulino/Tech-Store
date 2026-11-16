import type { EChartsCoreOption } from 'echarts/core'
import type { AnaliseVendas } from '../services/analiseService'

export const formatSalesCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Configuração do gráfico
export function salesChartOptions(data: AnaliseVendas, fontIncrease = 0): EChartsCoreOption {
  return {
    animationDuration: 220, animationDurationUpdate: 180,
    textStyle: { fontFamily: 'inherit', fontSize: 12 + fontIncrease },
    color: ['#ef691f', '#2563eb', '#16846b', '#8b5ac7', '#bd3d62', '#64748b', '#b77912'],
    tooltip: { trigger: 'axis', confine: true, textStyle: { fontSize: 14 + fontIncrease }, valueFormatter: (value: unknown) => formatSalesCurrency(Number(value)) },
    legend: { bottom: 0, left: 'center', icon: 'circle', type: 'scroll', itemGap: 22 },
    grid: { left: 16, right: 28, top: 42, bottom: 85, containLabel: true },
    xAxis: { type: 'category', name: 'Mês/ano', nameLocation: 'middle', nameGap: 30, boundaryGap: false,
      data: data.meses.map(m => m.slice(5) + '/' + m.slice(0, 4)), axisTick: { show: false }, axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', name: 'Vendas (R$)', min: 0, axisLabel: { formatter: formatSalesCurrency }, splitLine: { lineStyle: { color: '#edf0f5' } } },
    series: data.series.map(s => ({ name: s.nome, type: 'line', symbol: 'circle', symbolSize: 7,
      lineStyle: { width: 3 }, emphasis: { focus: 'series' }, data: s.valores, connectNulls: false })),
  }
}
