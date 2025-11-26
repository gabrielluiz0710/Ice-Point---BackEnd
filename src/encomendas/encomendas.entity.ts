// src/encomendas/encomendas.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { EncomendaItens } from './encomenda-itens.entity';
// Importe a entidade Usuarios quando ela for criada
// import { Usuarios } from '../usuarios/usuarios.entity';

@Entity('encomendas') // Nome da tabela no seu DB: ENCOMENDAS
export class Encomendas {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', name: 'cliente_id' })
  cliente_id: string; // UUID do Supabase Auth

  @Column({ nullable: true, name: 'carrinho_id' })
  carrinho_id: number;

  @Column({ type: 'timestamp with time zone', default: () => 'now()', name: 'data_solicitacao' })
  data_solicitacao: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00, name: 'valor_total' })
  valor_total: number;

  @Column({ type: 'enum', enum: ['PENDENTE', 'APROVADO', 'EM_PREPARO', 'ENTREGUE', 'CANCELADO'] })
  status: 'PENDENTE' | 'APROVADO' | 'EM_PREPARO' | 'ENTREGUE' | 'CANCELADO';

  @OneToMany(() => EncomendaItens, item => item.encomenda, { cascade: true })
  itens: EncomendaItens[];
}