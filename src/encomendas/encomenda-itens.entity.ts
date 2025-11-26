// src/encomendas/encomenda-itens.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Encomendas } from './encomendas.entity';
// import { Produtos } from '../produtos/produtos.entity'; // Entidade Produtos futura

@Entity('encomenda_itens') // Nome da tabela no seu DB: ENCOMENDA_ITENS
export class EncomendaItens {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'encomenda_id' })
  encomenda_id: number;

  @Column({ name: 'produto_id' })
  produto_id: number;

  @Column()
  quantidade: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'preco_unitario_congelado' })
  preco_unitario_congelado: number;

  @ManyToOne(() => Encomendas, encomenda => encomenda.itens)
  @JoinColumn({ name: 'encomenda_id' })
  encomenda: Encomendas;
  
  // Relação ManyToOne com Produtos (futuro)
  // @ManyToOne(() => Produtos)
  // @JoinColumn({ name: 'produto_id' })
  // produto: Produtos;
}