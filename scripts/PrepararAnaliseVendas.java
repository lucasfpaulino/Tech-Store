import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;

/** Massa histórica opt-in. Só insere IDs próprios; nunca refaz vendas ou altera pedidos existentes. */
class PrepararAnaliseVendas {
    static UUID id(String run,String key) { return UUID.nameUUIDFromBytes(("techstore:analise:v1:"+run+":"+key).getBytes(StandardCharsets.UTF_8)); }
    static String quote(Object value) { return "\""+value.toString().replace("\\","\\\\").replace("\"","\\\"")+"\""; }
    static int execute(Connection db,String sql,Object... values) throws SQLException {
        try(var q=db.prepareStatement(sql)) { for(int n=0;n<values.length;n++) q.setObject(n+1,values[n]); return q.executeUpdate(); }
    }
    static UUID category(Connection db,String name) throws SQLException {
        try(var q=db.prepareStatement("SELECT id FROM categorias WHERE nome=?")) {
            q.setString(1,name); try(var rs=q.executeQuery()) { if(!rs.next()) throw new IllegalArgumentException("Categoria não encontrada."); return rs.getObject(1,UUID.class); }
        }
    }
    public static void main(String[] args) throws Exception {
        if((args.length!=7&&args.length!=9)||!Set.of("public","techstore_e2e").contains(args[1])) throw new IllegalArgumentException("Esquema inválido.");
        boolean main=args[1].equals("public"); String run=args[args.length-1];
        if(main&&!run.equals("analise-local-v1")) throw new IllegalArgumentException("Execução principal deve ser idempotente.");
        if(!main) UUID.fromString(run);
        UUID client=UUID.fromString(args[2]); UUID[] products=Arrays.stream(args,3,args.length-1).map(UUID::fromString).toArray(UUID[]::new);
        if(products.length!=(main?3:5)) throw new IllegalArgumentException("Quantidade de produtos inválida para o ambiente.");
        var env=new Properties(); try(var reader=Files.newBufferedReader(Path.of(args[0]))) { env.load(reader); }
        String url=env.getProperty("DB_URL","");
        if(!url.matches("jdbc:postgresql://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?/Tech_store(\\?.*)?")) throw new IllegalArgumentException("Permitido somente no banco Tech_store local.");
        var credentials=new Properties(); credentials.setProperty("user",env.getProperty("DB_USERNAME")); credentials.setProperty("password",env.getProperty("DB_PASSWORD"));
        credentials.setProperty("connectTimeout","8"); credentials.setProperty("socketTimeout","20");
        try(var db=DriverManager.getConnection(url,credentials)) {
            db.setAutoCommit(false);
            try {
                execute(db,"SET LOCAL search_path TO "+args[1]);
                try(var q=db.prepareStatement("SELECT email FROM clientes WHERE id=?")) {
                    q.setObject(1,client); try(var rs=q.executeQuery()) {
                        if(!rs.next()||!rs.getString(1).equals(main?"analise.vendas@techstore.test":"cypress-analise-"+run+"@techstore.test")) throw new IllegalArgumentException("Cliente fora da massa de análise.");
                    }
                }
                try(var lock=db.createStatement()) { lock.execute("SELECT pg_advisory_xact_lock(581203762)"); }
                String[] names=main?new String[]{"Placas de vídeo","Memórias RAM","Armazenamento"}
                    :new String[]{"Placas de vídeo","Memórias RAM","Armazenamento","Processadores","Placas-mãe"};
                UUID[] cats=new UUID[names.length]; for(int i=0;i<names.length;i++) cats[i]=category(db,names[i]);
                // categoria, data, quantidade, preço histórico, estado. Valores fictícios de teste.
                var rows=new ArrayList<>(Arrays.asList(new String[][]{
                    {"0","2026-06-15","2","1000","ENTREGUE"},{"0","2026-06-15","1","500","ENTREGUE"},{"0","2026-07-15","1","1500","ENTREGUE"},
                    {"0","2026-08-15","1","800","ENTREGUE"},{"1","2026-06-15","2","200","ENTREGUE"},{"1","2026-08-15","3","250","ENTREGUE"},
                    {"0","2026-07-15","1","300","EM TRANSPORTE"},{"0","2026-06-15","1","7000","APROVADA"},{"1","2026-07-15","1","9000","REPROVADA"},
                    {"1","2026-08-15","1","8000","CANCELADO"},{"0","2026-06-15","1","6000","EM PROCESSAMENTO"},{"0","2026-09-15","1","99000","ENTREGUE"}
                }));
                // Amostra e2e mensal: quantidades e preços diferentes, com altas, quedas e uma lacuna deliberada.
                // São 12 registros de controle + 59 vendas distribuídas entre set/2025 e ago/2026.
                if(!main) {
                    rows.set(11,new String[]{"0","2026-09-15","3","1400.90","ENTREGUE"});
                    int[] prices={1350,180,300,850,550}, steps={35,8,15,25,20};
                    for(int m=0;m<12;m++) {
                        var month=YearMonth.of(2025,9).plusMonths(m);
                        for(int cat=0;cat<names.length;cat++) {
                            if(cat==1&&month.equals(YearMonth.of(2026,2))) continue;
                            int qty=2+(m*3+cat*2)%7;
                            var price=BigDecimal.valueOf(prices[cat]+(((m*11+cat*7)%9)-4)*steps[cat]).add(new BigDecimal("0.90"));
                            rows.add(new String[]{String.valueOf(cat),month.atDay(5+(m+cat*3)%20).toString(),String.valueOf(qty),price.toPlainString(),"ENTREGUE"});
                        }
                    }
                }
                int added=0; long pendingNumber=0;
                for(int n=0;n<rows.size();n++) {
                    var row=rows.get(n); int cat=Integer.parseInt(row[0]),qty=Integer.parseInt(row[2]);
                    var price=new BigDecimal(row[3]); var total=price.multiply(BigDecimal.valueOf(qty));
                    var when=Timestamp.from(LocalDate.parse(row[1]).atTime(12,0).atZone(ZoneId.of("America/Sao_Paulo")).toInstant());
                    var order=id(run,"pedido-"+n); var item=id(run,"item-"+n);
                    added+=execute(db,"""
                        INSERT INTO pedidos(id,cliente_id,endereco_entrega,total,subtotal,status,criado_em,atualizado_em)
                        VALUES(?,?,'Endereço histórico de Arujá/SP',?,?,?,?,?) ON CONFLICT(id) DO NOTHING
                        """,order,client,total,total,row[4],when,when);
                    execute(db,"""
                        INSERT INTO itens_pedido(id,pedido_id,produto_id,nome_produto,preco_unitario,quantidade,criado_em,atualizado_em)
                        SELECT ?,?,id,nome,?,?,?,? FROM produtos WHERE id=? ON CONFLICT(id) DO NOTHING
                        """,item,order,price,qty,when,when,products[cat]);
                    execute(db,"INSERT INTO item_pedido_categorias VALUES(?,?,?) ON CONFLICT DO NOTHING",item,cats[cat],names[cat]);
                    var paid=Set.of("ENTREGUE","APROVADA","EM TRANSPORTE").contains(row[4]);
                    execute(db,"""
                        INSERT INTO pagamentos(id,pedido_id,valor,status,referencia,criado_em,atualizado_em)
                        VALUES(?,?,?,?, 'HISTORICO-ANALISE-LOCAL',?,?) ON CONFLICT(id) DO NOTHING
                        """,id(run,"pagamento-"+n),order,total,paid?"APROVADO":row[4].equals("REPROVADA")?"REPROVADO":row[4].equals("CANCELADO")?"CANCELADO":"PENDENTE",when,when);
                    execute(db,"""
                        INSERT INTO auditorias(id,responsavel,operacao,entidade,alteracoes)
                        VALUES(?,'DADOS_LOCAIS','PREPARAR_ANALISE',?,?) ON CONFLICT(id) DO NOTHING
                        """,id(run,"auditoria-"+n),"Pedido:"+order,"{\"antes\":{},\"depois\":{\"origem\":\"historico-analise\",\"clienteId\":\""+client+"\",\"pedidoId\":\""+order+"\"}}");
                    if(n==6) try(var q=db.prepareStatement("SELECT numero FROM pedidos WHERE id=?")) { q.setObject(1,order); try(var rs=q.executeQuery()) { rs.next(); pendingNumber=rs.getLong(1); } }
                }
                // Oráculo independente: lê itens individuais, testa o status em Java e soma sem reutilizar o SQL de agregação da API.
                var first=main?YearMonth.of(2026,6):YearMonth.of(2025,1); var current=YearMonth.now(ZoneId.of("America/Sao_Paulo"));
                var last=current.isBefore(YearMonth.of(2026,9))?YearMonth.of(2026,9):current;
                var months=new ArrayList<String>(); for(var m=first;!m.isAfter(last);m=m.plusMonths(1)) months.add(m.toString());
                var totals=new BigDecimal[cats.length][months.size()]; for(var values:totals) Arrays.fill(values,new BigDecimal("0.00"));
                try(var q=db.prepareStatement("""
                    SELECT hc.categoria_id,p.status,p.criado_em,i.preco_unitario,i.quantidade
                    FROM pedidos p JOIN itens_pedido i ON i.pedido_id=p.id JOIN item_pedido_categorias hc ON hc.item_pedido_id=i.id
                    WHERE p.criado_em >= ? AND p.criado_em < ?
                      AND hc.categoria_id IN (%s)
                    """.formatted(String.join(",",Collections.nCopies(cats.length,"?"))))) {
                    q.setTimestamp(1,Timestamp.from(first.atDay(1).atStartOfDay(ZoneId.of("America/Sao_Paulo")).toInstant()));
                    q.setTimestamp(2,Timestamp.from(last.plusMonths(1).atDay(1).atStartOfDay(ZoneId.of("America/Sao_Paulo")).toInstant()));
                    for(int i=0;i<cats.length;i++) q.setObject(i+3,cats[i]);
                    try(var rs=q.executeQuery()) { while(rs.next()) {
                        if(!rs.getString(2).equals("ENTREGUE")) continue;
                        int cat=Arrays.asList(cats).indexOf(rs.getObject(1,UUID.class));
                        int month=(int)java.time.temporal.ChronoUnit.MONTHS.between(first,YearMonth.from(rs.getTimestamp(3).toInstant().atZone(ZoneId.of("America/Sao_Paulo"))));
                        totals[cat][month]=totals[cat][month].add(rs.getBigDecimal(4).multiply(BigDecimal.valueOf(rs.getInt(5))));
                    } }
                }
                var series=new ArrayList<String>();
                for(int i=0;i<cats.length;i++) series.add("{\"id\":"+quote(cats[i])+",\"nome\":"+quote(names[i])+",\"valores\":"+Arrays.toString(totals[i])+"}");
                db.commit();
                System.out.println("{\"novosPedidos\":"+added+",\"clienteId\":"+quote(client)+",\"inicio\":\"2026-06-01\",\"fim\":\"2026-08-31\",\"fimAtual\":"+quote(last.atEndOfMonth())+",\"meses\":["+String.join(",",months.stream().map(PrepararAnaliseVendas::quote).toList())+"],\"categorias\":["+String.join(",",series)+"],\"pendente\":{\"id\":"+quote(id(run,"pedido-6"))+",\"numero\":"+pendingNumber+",\"mes\":\"2026-07\",\"valor\":300}}");
            } catch(Exception error) { db.rollback(); throw error; }
        } catch(SQLException error) { System.err.println("Falha na massa de análise. SQLState="+error.getSQLState()); System.exit(1); }
    }
}
