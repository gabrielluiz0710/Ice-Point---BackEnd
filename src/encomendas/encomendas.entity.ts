import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { EncomendaItens } from './encomenda-itens.entity';
import { Carrinho } from '../carrinhos/carrinho.entity';

@Entity('encomendas') 
export class Encomendas {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'uuid', name: 'cliente_id' })
  cliente_id: string;

  @Column({ type: 'timestamp with time zone', default: () => 'now()', name: 'data_solicitacao' })
  data_solicitacao: Date;

  @Column({ type: 'timestamp with time zone', nullable: true, name: 'data_entrega' })
  data_entrega: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0.00, name: 'valor_total' })
  valor_total: number;

  @Column({ type: 'enum', enum: ['PENDENTE', 'APROVADO', 'EM_PREPARO', 'ENTREGUE', 'CANCELADO'] })
  status: 'PENDENTE' | 'APROVADO' | 'EM_PREPARO' | 'ENTREGUE' | 'CANCELADO';

  @OneToMany(() => EncomendaItens, item => item.encomenda, { cascade: true })
  itens: EncomendaItens[];

  @ManyToMany(() => Carrinho)
  @JoinTable({
    name: 'encomendas_carrinhos',
    joinColumn: { name: 'encomenda_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'carrinho_id', referencedColumnName: 'id' },
  })
  carrinhos: Carrinho[];
}