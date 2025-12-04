import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm'; 
import { CartItemDto } from './dto/cart-transfer.dto';
import { Encomendas } from '../encomendas/encomendas.entity';
import { EncomendaItens } from '../encomendas/encomenda-itens.entity';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Encomendas)
    private readonly encomendaRepository: Repository<Encomendas>,
    @InjectRepository(EncomendaItens)
    private readonly itemRepository: Repository<EncomendaItens>,
  ) {}

  async transferAnonCart(userId: string, anonItems: CartItemDto[]) {
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

    if (!activeCart.itens) {
        activeCart.itens = [];
    }
    
    const itemsToCreate: EncomendaItens[] = [];
    let valorTotalRecalculado = Number(activeCart.valor_total || 0); 

    for (const anonItem of anonItems) {
        const simulatedPrice = 4.00; 
        
        const existingItemIndex = activeCart.itens.findIndex(item => item.produto_id === anonItem.productId);

        if (existingItemIndex !== -1) {
            activeCart.itens[existingItemIndex].quantidade += anonItem.quantity;
            await this.itemRepository.save(activeCart.itens[existingItemIndex]);
        } else {
            const newItem = this.itemRepository.create({
              encomenda_id: activeCart.id,
              produto_id: anonItem.productId,
              quantidade: anonItem.quantity,
              preco_unitario_congelado: simulatedPrice,
            });
            itemsToCreate.push(newItem);
        }
        valorTotalRecalculado += simulatedPrice * anonItem.quantity; 
    }
    
    if (itemsToCreate.length > 0) {
        await this.itemRepository.insert(itemsToCreate);
    }
    
    await this.encomendaRepository.update(activeCart.id, { valor_total: valorTotalRecalculado });

    return this.encomendaRepository.findOne({ 
        where: { id: activeCart.id },
        relations: ['itens'] 
    });
  }
}