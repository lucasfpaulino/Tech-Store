param(
    [string]$ApiBase='http://127.0.0.1:8080/api',
    [ValidateSet('public','techstore_e2e')][string]$BancoSchema='public',
    [string]$ExecucaoId='analise-local-v1',
    [string]$FrontendBase=''
)
$ErrorActionPreference='Stop'
# UTF-8 explícito também no Windows PowerShell 5.1: preserva JSON e nomes com acentos.
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$OutputEncoding=[Console]::OutputEncoding
function Invoke-AnalysisJson([string]$Url,[string]$Method='Get',[hashtable]$Data) {
    $request=@{Uri=$Url; Method=$Method; UseBasicParsing=$true; TimeoutSec=8}
    if($null -ne $Data) {
        $request.ContentType='application/json; charset=utf-8'
        $request.Body=[Text.Encoding]::UTF8.GetBytes(($Data | ConvertTo-Json -Depth 8))
    }
    $response=Invoke-WebRequest @request
    # O PowerShell 5.1 pode interpretar JSON sem charset como Latin-1.
    # O backend envia JSON em UTF-8: decodifica os bytes sem depender desse padrão.
    [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray()) | ConvertFrom-Json
}
$uri=[Uri]$ApiBase
if ($uri.Host -notin @('localhost','127.0.0.1','::1') -or
    ($BancoSchema -eq 'public' -and ($uri.Port -ne 8080 -or $ExecucaoId -ne 'analise-local-v1')) -or
    ($BancoSchema -eq 'techstore_e2e' -and ($uri.Port -ne 8081 -or $ExecucaoId -notmatch '^[0-9a-f-]{36}$'))) { throw 'Use somente o ambiente local correspondente ao schema e uma execução válida.' }
# Falha antes de criar qualquer cadastro se a API estiver desligada ou no schema errado.
$origin=$uri.GetLeftPart([UriPartial]::Authority)
try { $health=Invoke-AnalysisJson "$origin/actuator/health" }
catch {
    $start=if($BancoSchema -eq 'techstore_e2e'){'.\mvnw.cmd ''-Dspring-boot.run.profiles=e2e'' spring-boot:run'}else{'.\mvnw.cmd spring-boot:run'}
    throw "Preparação da análise: a API em $origin não está disponível. Inicie o PostgreSQL e, na pasta Backend, execute: $start. Aguarde o Spring Boot iniciar antes de executar o Cypress."
}
if($health.status -ne 'UP'){throw 'Preparação da análise: a API ou o PostgreSQL não está saudável (health diferente de UP).'}
if($BancoSchema -eq 'techstore_e2e') {
    $info=Invoke-AnalysisJson "$origin/actuator/info"
    if($info.app.ambiente -ne 'e2e' -or $info.app.schema -ne 'techstore_e2e') {
        throw 'Preparação da análise: a API 8081 não confirmou o perfil e2e/schema techstore_e2e. Reinicie o backend com -Dspring-boot.run.profiles=e2e; nenhum dado foi preparado.'
    }
    if($FrontendBase) {
        $frontUri=[Uri]$FrontendBase
        if($frontUri.Host -notin @('localhost','127.0.0.1','::1') -or $frontUri.Port -ne 5174) {
            throw 'Preparação da análise: o Cypress deve usar o frontend e2e local na porta 5174.'
        }
        try { $proxyInfo=Invoke-AnalysisJson "$($FrontendBase.TrimEnd('/'))/actuator/info" }
        catch { throw 'Preparação da análise: o frontend 5174 ou seu proxy está indisponível. Execute npm.cmd run dev:e2e na pasta Frontend e mantenha a API e2e 8081 ativa.' }
        if($proxyInfo.app.ambiente -ne 'e2e' -or $proxyInfo.app.schema -ne 'techstore_e2e') {
            throw 'Preparação da análise: o proxy do frontend não aponta para a API e2e. Use npm.cmd run dev:e2e e confira API_PROXY_TARGET; nenhum dado foi preparado.'
        }
    }
}
$envFile=Join-Path (Split-Path $PSScriptRoot -Parent) '.env'
if(-not (Test-Path -LiteralPath $envFile)){throw 'Preparação da análise: o .env local da raiz do projeto não foi encontrado.'}
$java=if($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))){Join-Path $env:JAVA_HOME 'bin/java.exe'}else{(Get-Command java -ErrorAction Stop).Source}
$driver=Get-ChildItem (Join-Path $env:USERPROFILE '.m2/repository/org/postgresql/postgresql/*/postgresql-*.jar') -ErrorAction SilentlyContinue |
    Where-Object Name -Match '^postgresql-[0-9]+\.[0-9]+\.[0-9]+\.jar$' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if(-not $driver){throw 'Preparação da análise: driver PostgreSQL não encontrado. Execute .\mvnw.cmd compile na pasta Backend.'}
function Send-AnalysisData([string]$Route,[hashtable]$Data) {
    Invoke-AnalysisJson "$ApiBase/$Route" 'Post' $Data
}
$email=if($BancoSchema -eq 'public'){'analise.vendas@techstore.test'}else{"cypress-analise-$ExecucaoId@techstore.test"}
$clients=Invoke-AnalysisJson "$ApiBase/clientes?email=$([Uri]::EscapeDataString($email))"
$client=$clients | Where-Object email -eq $email | Select-Object -First 1
if(-not $client) {
    $cpf=if($BancoSchema -eq 'public'){'794206351'}else{[string](Get-Random -Minimum 100000000 -Maximum 999999999)}
    for($length=9;$length -le 10;$length++) {
        $sum=0; for($n=0;$n -lt $length;$n++){$sum+=[int]::Parse($cpf.Substring($n,1))*($length+1-$n)}
        $digit=($sum*10)%11; if($digit -eq 10){$digit=0}; $cpf+=[string]$digit
    }
    $client=Send-AnalysisData 'clientes' @{
        nome=if($BancoSchema -eq 'public'){'Gabriel Rocha'}else{"Cliente Cypress Análise $ExecucaoId"}
        genero='Masculino'; cpf=$cpf; email=$email; dataNascimento='1997-05-14'; tipoTelefone='Celular'; ddd='11'; telefone='987654321'
        senha='Teste@2026'; confirmacaoSenha='Teste@2026'
        enderecos=@(@{nome='Casa'; tipoResidencia='Casa'; tipoLogradouro='Rua'; logradouro='dos Testes'; numero='120'; bairro='Centro'; cep='07400000'
            cidade='Arujá'; estado='SP'; pais='Brasil'; residencial=$true; entrega=$true; cobranca=$true})
    }
}
$domains=Invoke-AnalysisJson "$ApiBase/dominios/catalogo"
$group=$domains.grupos | Where-Object nome -eq 'Padrão' | Select-Object -First 1
$products=Invoke-AnalysisJson "$ApiBase/produtos"
$ids=@()
$models=@(
    @{nome='GeForce RTX 5060 8 GB'; marca='NVIDIA'; custo=1500; categoria='Placas de vídeo'; imagem=''},
    @{nome='Memória DDR5 32 GB 6000 MHz'; marca='Kingston'; custo=400; categoria='Memórias RAM'; imagem='/images/products/ddr5-32gb-6000.png'},
    @{nome='SSD NVMe 2 TB'; marca='Kingston'; custo=450; categoria='Armazenamento'; imagem='/images/products/ssd-nvme-2tb.png'}
)
if($BancoSchema -eq 'techstore_e2e') {
    $models+=@(
        @{nome='AMD Ryzen 5 7600'; marca='AMD'; custo=900; categoria='Processadores'; imagem=''},
        @{nome='Placa-mãe B650M'; marca='ASUS'; custo=600; categoria='Placas-mãe'; imagem=''}
    )
}
foreach($model in $models) {
    $product=$products | Where-Object nome -eq $model.nome | Select-Object -First 1
    if(-not $product) {
        $category=$domains.categorias | Where-Object nome -eq $model.categoria | Select-Object -First 1
        if(-not $group -or -not $category){throw 'Domínios de hardware não encontrados.'}
        $product=Send-AnalysisData 'produtos' @{nome=$model.nome; marca=$model.marca; descricao='Hardware para consultas do histórico de vendas da Tech Store.'
            imagem=$model.imagem; custo=$model.custo; preco=($model.custo*2); quantidade=0; ativo=$true; grupoPrecificacaoId=$group.id; categorias=@($category.id)}
        # A entrada abaixo calcula o preço definitivo pela margem do grupo no backend.
        $suppliers=Invoke-AnalysisJson "$ApiBase/fornecedores"
        $supplier=$suppliers | Where-Object nome -eq 'Distribuidora Análise Local' | Select-Object -First 1
        if(-not $supplier){$supplier=Send-AnalysisData 'fornecedores' @{nome='Distribuidora Análise Local'}}
        $null=Send-AnalysisData 'estoque/entradas' @{produtoId=$product.id; fornecedorId=$supplier.id; quantidade=20; custoUnitario=$model.custo; dataEntrada=(Get-Date -Format 'yyyy-MM-dd')}
    }
    $ids+=$product.id
}
& $java '-Dfile.encoding=UTF-8' '-Dstdout.encoding=UTF-8' '-Dstderr.encoding=UTF-8' --class-path $driver.FullName (Join-Path $PSScriptRoot 'PrepararAnaliseVendas.java') $envFile $BancoSchema $client.id @ids $ExecucaoId
if($LASTEXITCODE -ne 0){throw 'Falha na preparação do histórico de análise.'}
