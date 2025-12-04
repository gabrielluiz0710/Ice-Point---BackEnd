import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Category } from './category.entity';
import { ProductImage } from './product-image.entity';

@Entity('produtos')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'categoria_id', nullable: true })
  categoriaId: number;

  @Column()
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  preco_unitario: number;

  @Column({ default: true })
  disponivel: boolean;

  @Column({ type: 'text', nullable: true })
  ingredientes: string;

  @Column({ type: 'text', nullable: true })
  alergicos: string;

  @Column({ type: 'jsonb', name: 'informacao_nutricional', default: {} })
  informacaoNutricional: any;

  @Column({ name: 'imagem_capa', type: 'text', nullable: true })
  imagemCapa: string | null;
  
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Category, (category) => category.produtos, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'categoria_id' })
  categoria: Category;

  @OneToMany(() => ProductImage, (image) => image.produto, { cascade: true })
  imagens: ProductImage[];
}