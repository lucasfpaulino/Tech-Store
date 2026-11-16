import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Checkbox, FormControlLabel, LinearProgress, TextField } from '@mui/material'
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { analiseService, type AnaliseVendas, type FiltroVendas } from '../services/analiseService'
import { produtoService } from '../services/produtoService'
import { errorMessage } from '../services/api'
import { useDemoStore } from '../context/DemoContext'
import { formatSalesCurrency as brl, salesChartOptions } from '../utils/salesChartOptions'

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])
const date = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function period(months: number) {
  const now = new Date()
  return { inicio: date(new Date(now.getFullYear(), now.getMonth() - months + 1, 1)), fim: date(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
}
function Chart({ data }: { data: AnaliseVendas }) {
  const element = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!element.current) return
    const chart = echarts.init(element.current)
    const fontIncrease = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-size-increase')) || 0
    chart.setOption(salesChartOptions(data, fontIncrease))
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(element.current)
    return () => { observer.disconnect(); chart.dispose() }
  }, [data])
  return <div ref={element} className="sales-chart" role="img" aria-label="Gráfico de linhas de vendas ENTREGUE em reais por mês e categoria" />
}
export function SalesChart() {
  const { isAdminProfile } = useDemoStore()
  const domains = useQuery({ queryKey: ['dominios-catalogo'], queryFn: produtoService.dominios, enabled: isAdminProfile })
  const [dates, setDates] = useState(() => period(6))
  const [selected, setSelected] = useState<string[] | null>(null)
  const [filter, setFilter] = useState<FiltroVendas | null>(null)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const options = domains.data?.categorias ?? []
  const categories = selected ?? options.map(c => c.id)
  const applied = filter ?? { ...period(6), categorias: options.map(c => c.id) }
  // Reconsulta ao aplicar os filtros
  const query = useQuery({ queryKey: ['analise-vendas', applied, revision], queryFn: ({ signal }) => analiseService.consultar(applied, signal),
    enabled: isAdminProfile && applied.categorias.length > 0, retry: false })
  const apply = (event: FormEvent) => {
    event.preventDefault()
    if (!dates.inicio || !dates.fim) { setError('Informe as datas inicial e final.'); return }
    if (dates.fim < dates.inicio) { setError('A data final não pode ser anterior à inicial.'); return }
    if (!categories.length) { setError('Selecione ao menos uma categoria.'); return }
    setError(''); setFilter({ ...dates, categorias: [...categories].sort() }); setRevision(value => value + 1)
  }
  const exportData = async () => {
    setError(''); setExporting(true)
    try {
      const blob = await analiseService.exportar(applied)
      const url = URL.createObjectURL(blob), anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'tech-store-vendas.csv'; anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { setError(errorMessage(cause)) } finally { setExporting(false) }
  }
  if (!isAdminProfile) return <Alert severity="warning">Acesso restrito ao perfil administrador.</Alert>
  return <>
    <Box component="form" aria-label="Filtros de vendas" onSubmit={apply} className="sales-filters">
      <div className="sales-filters__dates">
        <TextField label="Data inicial" name="inicio" type="date" value={dates.inicio} onChange={e => setDates({ ...dates, inicio: e.target.value })} required slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Data final" name="fim" type="date" value={dates.fim} onChange={e => setDates({ ...dates, fim: e.target.value })} required slotProps={{ inputLabel: { shrink: true } }} />
        <div className="sales-filters__periods" aria-label="Períodos rápidos">{[3, 6, 12, 24].map(n => <Button key={n} type="button" onClick={() => setDates(period(n))}>{n} meses</Button>)}</div>
      </div>
      <fieldset className="sales-filters__categories"><legend>Categorias para comparação</legend>
        <div>{options.map(c => <FormControlLabel key={c.id} label={c.nome} control={<Checkbox name={'categoria-' + c.id} checked={categories.includes(c.id)} onChange={e => setSelected(e.target.checked ? [...categories, c.id] : categories.filter(id => id !== c.id))} />} />)}</div>
        <div className="sales-filters__selection"><span>{categories.length} categoria(s) selecionada(s)</span><Button type="button" onClick={() => setSelected(options.map(c => c.id))}>Todas as categorias</Button><Button type="button" onClick={() => setSelected([])}>Limpar categorias</Button></div>
      </fieldset>
      <div className="sales-filters__actions"><Button variant="contained" type="submit" disabled={domains.isLoading}>Aplicar filtros</Button>
        <Button type="button" disabled={!query.data || query.isFetching || query.isError || !!error || exporting} onClick={() => void exportData()}>Exportar planilha (CSV)</Button>
      </div>
    </Box>
    {(domains.isLoading || query.isFetching) && <LinearProgress aria-label="Consultando histórico de vendas" />}
    {(error || domains.error || query.error) && <Alert severity="error">{error || errorMessage(domains.error ?? query.error)}{query.isError && <Button onClick={() => setRevision(value => value + 1)}>Tentar novamente</Button>}</Alert>}
    {!domains.isLoading && !domains.error && !options.length && <Alert severity="info">Nenhuma categoria cadastrada para consulta.</Alert>}
    {query.data && !query.isError && !error && <section className="sales-result" aria-label="Resultado da análise de vendas" aria-busy={query.isFetching}>
      <div className="sales-result__heading"><div><h2>Vendas entregues por categoria</h2><p>Período: {query.data.inicio.split('-').reverse().join('/')} a {query.data.fim.split('-').reverse().join('/')}</p></div><span className="status status--success">Somente ENTREGUE</span></div>
      <p className="sales-result__criterion">{query.data.criterio}</p>
      {query.data.series.every(s => s.valores.every(value => value === 0)) && <Alert severity="info">Não há vendas ENTREGUE para os filtros selecionados. Os meses permanecem com R$ 0,00.</Alert>}
      <Chart data={query.data} />
      <details className="sales-result__data"><summary>Dados do gráfico</summary><div className="sales-result__table"><table aria-label="Dados de vendas"><thead><tr><th scope="col">Mês</th>{query.data.series.map(s => <th scope="col" key={s.categoriaId}>{s.nome}</th>)}</tr></thead><tbody>{query.data.meses.map((m, i) => <tr key={m}><th scope="row">{m.slice(5) + '/' + m.slice(0, 4)}</th>{query.data?.series.map(s => <td key={s.categoriaId}>{brl(s.valores[i])}</td>)}</tr>)}</tbody></table></div></details>
    </section>}
  </>
}
