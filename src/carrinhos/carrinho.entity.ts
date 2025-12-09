import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('carrinhos')
export class Carrinho {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  identificacao: string;

  @Column()
  capacidade: number;

  @Column({ default: 'DISPONIVEL' })
  status: string;

  @Column({ nullable: true })
  cor: string;
}