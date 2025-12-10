import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Encomendas } from './encomendas.entity';
import { Carrinho } from '../carrinhos/carrinho.entity';

@Entity('encomendas_carrinhos')
export class EncomendasCarrinhos {
  @PrimaryColumn({ name: 'encomenda_id' })
  encomendaId: number;

  @PrimaryColumn({ name: 'carrinho_id' })
  carrinhoId: number;

  @ManyToOne(() => Encomendas, (encomenda) => encomenda.carrinhos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'encomenda_id' })
  encomenda: Encomendas;

  @ManyToOne(() => Carrinho, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'carrinho_id' })
  carrinho: Carrinho;
}