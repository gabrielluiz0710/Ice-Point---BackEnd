import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('produto_imagens')
export class ProductImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'produto_id' })
  produtoId: number;

  @Column()
  url: string;

  @Column({ name: 'caminho_storage' })
  caminhoStorage: string;

  @Column({ default: 0 })
  ordem: number;

  @ManyToOne(() => Product, (product) => product.imagens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'produto_id' })
  produto: Product;
}