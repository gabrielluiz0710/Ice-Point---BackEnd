import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
} from 'typeorm';
import { EncomendaItens } from './encomenda-itens.entity';
import { Carrinho } from '../carrinhos/carrinho.entity';
import {
  EncomendaStatus,
  MetodoEntrega,
  MetodoPagamento,
} from './encomenda.enums';

@Entity('encomendas')
export class Encomendas {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', name: 'cliente_id', nullable: true })
  clienteId: string;

  @Column({ name: 'nome_cliente', nullable: true })
  nomeCliente: string;

  @Column({ name: 'email_cliente', nullable: true })
  emailCliente: string;

  @Column({ name: 'telefone_cliente', length: 20, nullable: true })
  telefoneCliente: string;

  @Column({ name: 'cpf_cliente', length: 14, nullable: true })
  cpfCliente: string;

  @Column({ type: 'date', name: 'data_nascimento_cliente', nullable: true })
  dataNascimentoCliente: string | null;

  @CreateDateColumn({
    name: 'data_solicitacao',
    type: 'timestamp with time zone',
  })
  dataSolicitacao: Date;

  @Column({ type: 'date', name: 'data_agendada', nullable: true })
  dataAgendada: string;

  @Column({ type: 'time', name: 'hora_agendada', nullable: true })
  horaAgendada: string;

  @Column({
    type: 'enum',
    enum: MetodoEntrega,
    name: 'metodo_entrega',
    nullable: true,
  })
  metodoEntrega: MetodoEntrega;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'taxa_entrega',
    nullable: true,
  })
  taxaEntrega: number;

  @Column({ name: 'endereco_cep', nullable: true })
  enderecoCep: string;

  @Column({ name: 'endereco_logradouro', nullable: true })
  enderecoLogradouro: string;

  @Column({ name: 'endereco_numero', nullable: true })
  enderecoNumero: string;

  @Column({ name: 'endereco_complemento', nullable: true })
  enderecoComplemento: string;

  @Column({ name: 'endereco_bairro', nullable: true })
  enderecoBairro: string;

  @Column({ name: 'endereco_cidade', nullable: true })
  enderecoCidade: string;

  @Column({ name: 'endereco_estado', nullable: true })
  enderecoEstado: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'valor_produtos',
    nullable: true,
  })
  valorProdutos: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'valor_desconto',
    nullable: true,
  })
  valorDesconto: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
    name: 'valor_total',
    nullable: true,
  })
  valorTotal: number;

  @Column({
    type: 'enum',
    enum: MetodoPagamento,
    name: 'metodo_pagamento',
    nullable: true,
  })
  metodoPagamento: MetodoPagamento;

  @Column({ name: 'status_pagamento', default: 'PENDENTE' })
  statusPagamento: string;

  @Column({ name: 'id_pagamento_externo', nullable: true })
  idPagamentoExterno: string;

  @Column({
    type: 'enum',
    enum: EncomendaStatus,
    default: EncomendaStatus.PENDENTE,
  })
  status: EncomendaStatus;

  @Column({ name: 'motivo_cancelamento', type: 'text', nullable: true })
  motivoCancelamento: string;

  @Column({ name: 'google_event_id', nullable: true })
  googleEventId: string;

  @OneToMany(() => EncomendaItens, (item) => item.encomenda, { cascade: true })
  itens: EncomendaItens[];

  @ManyToMany(() => Carrinho)
  @JoinTable({
    name: 'encomendas_carrinhos',
    joinColumn: { name: 'encomenda_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'carrinho_id', referencedColumnName: 'id' },
  })
  carrinhos: Carrinho[];
}
