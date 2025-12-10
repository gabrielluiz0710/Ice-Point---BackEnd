import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Encomendas } from './encomendas.entity';
import { Product } from '../products/entities/product.entity';

@Entity('encomenda_itens')
export class EncomendaItens {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'encomenda_id' })
  encomendaId: number;

  @Column({ name: 'produto_id' })
  produtoId: number;

  @Column()
  quantidade: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, name: 'preco_unitario_congelado' })
  precoUnitarioCongelado: number;

  @ManyToOne(() => Encomendas, encomenda => encomenda.itens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encomenda_id' })
  encomenda: Encomendas;
  
  @ManyToOne(() => Product)
  @JoinColumn({ name: 'produto_id' })
  produto: Product;
}