import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In, LessThanOrEqual, MoreThanOrEqual } from 'typeorm'; 
import { CartItemDto } from './dto/cart-transfer.dto';
import { Encomendas } from '../encomendas/encomendas.entity';
import { EncomendaItens } from '../encomendas/encomenda-itens.entity';
import { Product } from '../products/entities/product.entity'; 
import { Carrinho } from '../carrinhos/carrinho.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Encomendas)
    private readonly encomendaRepository: Repository<Encomendas>,
    @InjectRepository(EncomendaItens)
    private readonly itemRepository: Repository<EncomendaItens>,
    @InjectRepository(Product)
    private readonly produtoRepository: Repository<Product>,
    @InjectRepository(Carrinho) 
    private readonly carrinhoRepository: Repository<Carrinho>,
  ) {}

  async getActiveCart(userId: string) {
    return this.encomendaRepository.findOne({
      where: { cliente_id: userId, status: 'PENDENTE' as any },
      relations: ['itens'], 
    });
  }

  async transferAnonCart(userId: string, anonItems: CartItemDto[]) {
    return this.syncCart(userId, anonItems);
  }

  async syncCart(userId: string, items: CartItemDto[]) {
    let activeCart = await this.encomendaRepository.findOne({
      where: { cliente_id: userId, status: 'PENDENTE' as any },
      relations: ['itens'], 
    });

    if (!activeCart) {
      activeCart = this.encomendaRepository.create({
        cliente_id: userId,
        status: 'PENDENTE',
        valor_total: 0.00,
        itens: []
      });
      activeCart = await this.encomendaRepository.save(activeCart);
    }

    const validItems = items.filter(i => i.quantity > 0);

    let novoValorTotal = 0;

    if (activeCart.itens && activeCart.itens.length > 0) {
        await this.itemRepository.delete({ encomenda_id: activeCart.id });
    }

    const itensParaSalvar: EncomendaItens[] = [];

    for (const itemDto of validItems) {
        const produto = await this.produtoRepository.findOne({ where: { id: itemDto.productId } });
        const preco = produto ? Number(produto.preco_unitario) : 0;

        const novoItem = this.itemRepository.create({
            encomenda_id: activeCart.id,
            produto_id: itemDto.productId,
            quantidade: itemDto.quantity,
            preco_unitario_congelado: preco 
        });

        itensParaSalvar.push(novoItem);
        novoValorTotal += preco * itemDto.quantity;
    }

    if (itensParaSalvar.length > 0) {
        await this.itemRepository.save(itensParaSalvar);
    }

    await this.encomendaRepository.update(activeCart.id, { valor_total: novoValorTotal });

    return { success: true, cartId: activeCart.id };
  }

  async checkAvailability(dateString: string) {
    const targetDate = new Date(dateString);
    
    const windowStart = new Date(targetDate.getTime() - (24 * 60 * 60 * 1000));
    const windowEnd = new Date(targetDate.getTime() + (24 * 60 * 60 * 1000));

    
    const busyCartsBuilder = this.encomendaRepository.createQueryBuilder('encomenda')
      .select('carrinho.id')
      .innerJoin('encomenda.carrinhos', 'carrinho') 
      .where('encomenda.status != :status', { status: 'CANCELADO' })
      .andWhere('encomenda.data_entrega >= :start', { start: windowStart })
      .andWhere('encomenda.data_entrega <= :end', { end: windowEnd });

    const availableCarts = await this.carrinhoRepository.createQueryBuilder('c')
      .where(`c.id NOT IN (${busyCartsBuilder.getQuery()})`)
      .setParameters(busyCartsBuilder.getParameters()) 
      .andWhere('c.status = :statusCarrinho', { statusCarrinho: 'DISPONIVEL' }) 
      .getMany();

    const summary = {
      totalAvailable: availableCarts.length,
      details: availableCarts.map(c => ({
        id: c.id,
        identificacao: c.identificacao,
        cor: c.cor,
        capacidade: c.capacidade
      })),
      byColor: availableCarts.reduce((acc, curr) => {
        const cor = curr.cor || 'Sem Cor';
        acc[cor] = (acc[cor] || 0) + 1;
        return acc;
      }, {})
    };

    return summary;
  }
}