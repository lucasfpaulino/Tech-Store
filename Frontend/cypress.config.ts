import { defineConfig } from 'cypress'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5174',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on, config) {
      const temposAnalise: { url: string; duracaoMs: number }[] = []
      on('task', {
        registrarTempoAnalise(value: { url: string; duracaoMs: number }) {
          if (!Number.isFinite(value.duracaoMs) || value.duracaoMs < 0) throw new Error('Medição de análise inválida.')
          temposAnalise.push(value)
          return null
        },
        async prepararAnalise() {
          try {
            if (!config.baseUrl) throw new Error('Configure baseUrl como http://localhost:5174 para os testes de análise.')
            // Usa o PowerShell nativo do Windows
            const powershell = process.platform === 'win32'
              ? resolve(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe') : 'pwsh'
            const { stdout } = await promisify(execFile)(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', resolve(config.projectRoot, '../scripts/preparar-analise-vendas.ps1'),
              '-ApiBase', 'http://127.0.0.1:8081/api', '-BancoSchema', 'techstore_e2e', '-ExecucaoId', randomUUID(), '-FrontendBase', config.baseUrl], { timeout: 60000, windowsHide: true })
            const base = JSON.parse(stdout.trim())
            if (!base.clienteId || base.categorias?.length !== 5 || !base.pendente?.id || !base.pendente.mes || base.novosPedidos !== 71)
              throw new Error('A preparação não retornou os 71 pedidos, cinco categorias disponíveis e o pedido pendente esperados.')
            return base
          } catch (cause) {
            const error = cause as Error & { code?: string; killed?: boolean; stderr?: string }
            const detail = error.code === 'ENOENT' ? 'Executável do PowerShell não encontrado no sistema.'
              : error.killed ? 'A preparação excedeu 60 segundos; verifique a API e o PostgreSQL.'
                : error.stderr?.trim() || error.message
            throw new Error('Não foi possível preparar a análise. ' + detail, { cause })
          }
        },
        async condicionarVenda({ clienteId, operacao, valor, referenciaId }: { clienteId: string; operacao: 'prazo' | 'estoque' | 'cupom' | 'pagamento'; valor: number; referenciaId?: string }) {
          const { stdout } = await promisify(execFile)('pwsh.exe', ['-NoProfile', '-File', resolve('../scripts/condicionar-venda-e2e.ps1'),
            '-ClienteId', clienteId, '-Operacao', operacao, '-Valor', String(valor),
            ...(referenciaId ? ['-ReferenciaId', referenciaId] : [])], { timeout: 60000, windowsHide: true })
          return JSON.parse(stdout.trim())
        },
        async auditoriaPedido({ clienteId, pedidoId }: { clienteId: string; pedidoId: string }) {
          const { stdout } = await promisify(execFile)('pwsh.exe', ['-NoProfile', '-File', resolve('../scripts/consultar-auditoria-pedido.ps1'),
            '-ClienteId', clienteId, '-PedidoId', pedidoId], { timeout: 60000, windowsHide: true })
          return JSON.parse(stdout.trim())
        },
        async prepararAdmin() {
          for (const script of ['preparar-dados-locais.ps1', 'preparar-dados-admin.ps1']) {
            await promisify(execFile)('pwsh.exe', ['-NoProfile', '-File', resolve('../scripts/' + script), '-ApiBase', 'http://127.0.0.1:8081/api', '-BancoSchema', 'techstore_e2e'], { timeout: 60000, windowsHide: true })
          }
          return null
        },
        async prepararPerfilLucas() {
          await promisify(execFile)('pwsh.exe', ['-NoProfile', '-File', resolve('../scripts/preparar-dados-locais.ps1'),
            '-ApiBase', 'http://127.0.0.1:8081/api', '-BancoSchema', 'techstore_e2e'], { timeout: 60000, windowsHide: true })
          return null
        },
      })
      on('after:run', async () => {
        if (temposAnalise.length) {
          const resultsPath = resolve(config.projectRoot, 'cypress/results')
          await mkdir(resultsPath, { recursive: true })
          await writeFile(resolve(resultsPath, `tempos-analise-${Date.now()}.json`), JSON.stringify({ limiteMs: 1000, amostras: temposAnalise }, null, 2))
        }
      })
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          launchOptions.args.push('--window-size=1920,1200', '--force-device-scale-factor=1')
        }
        return launchOptions
      })
    },
  },
  viewportWidth: 1680,
  viewportHeight: 1050,
  scrollBehavior: 'center',
  // Ritmo visual mais rápido. Não reduz os limites de espera por API/DOM.
  expose: { actionDelay: 40, pageDelay: 70, typeDelay: 1 },
  defaultCommandTimeout: 10000,
  video: true,
  screenshotOnRunFailure: true,
})
