package com.lucas.ecomm.venda.model;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import com.lucas.ecomm.shared.model.BaseModel;
import com.lucas.ecomm.cliente.model.*;
import com.lucas.ecomm.catalogo.model.*;
@Entity @Table(name="cupons")
public class CupomModel extends BaseModel {
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="cliente_id")
    private ClienteModel cliente;
    @Column(nullable=false, unique=true, length=60)
    private String codigo;
    @Column(nullable=false, length=20)
    private String tipo;
    @Column(nullable=false, precision=12, scale=2)
    private BigDecimal valor;
    @Column(nullable=false)
    private LocalDate validade;
    @Column(nullable=false)
    private boolean utilizado;
    // Libera o crédito após a aprovação
    public enum Liberacao { LIBERADO, PENDENTE, INVALIDADO }
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=12)
    private Liberacao liberacao=Liberacao.LIBERADO;
    public Liberacao getLiberacao() { return liberacao; }
    public void setLiberacao(Liberacao valor) { liberacao=valor; }
    public boolean podeUtilizar() { return liberacao==Liberacao.LIBERADO&&!utilizado&&!validade.isBefore(LocalDate.now()); }
    public String situacao() {
        if(liberacao==Liberacao.INVALIDADO) return "Invalidado";
        if(utilizado) return "Utilizado";
        if(validade.isBefore(LocalDate.now())) return "Expirado";
        return liberacao==Liberacao.PENDENTE?"Aguardando aprovação":"Disponível";
    }
    public ClienteModel getCliente() { return cliente; }
    public void setCliente(ClienteModel cliente) { this.cliente=cliente; }
    public String getCodigo() { return codigo; }
    public void setCodigo(String codigo) { this.codigo=codigo; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo=tipo; }
    public BigDecimal getValor() { return valor; }
    public void setValor(BigDecimal valor) { this.valor=valor; }
    public LocalDate getValidade() { return validade; }
    public void setValidade(LocalDate validade) { this.validade=validade; }
    public boolean getUtilizado() { return utilizado; }
    public void setUtilizado(boolean utilizado) { this.utilizado=utilizado; }
}
