// src/cart/cart.service.ts (Versão corrigida e TypeORM-ready)
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm'; // 👈 Apenas uma vez aqui!
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
    // Você precisará de um ProdutoService para buscar o preço real, vamos simular por enquanto.
    // private readonly productService: ProductService,
  ) {}

  async transferAnonCart(userId: string, anonItems: CartItemDto[]) {
    // 1. Tenta encontrar um carrinho ATIVO (PENDENTE) para este usuário
    let activeCart = await this.encomendaRepository.findOne({
      where: { cliente_id: userId, status: 'PENDENTE' as any },
      relations: ['itens'], 
    });

    if (!activeCart) {
      // 2. Se não houver, cria um novo carrinho/encomenda
      activeCart = this.encomendaRepository.create({
        cliente_id: userId,
        status: 'PENDENTE',
        valor_total: 0.00,
      });
      activeCart = await this.encomendaRepository.save(activeCart);
    }
    
    // Mapeamento e processamento dos itens (Otimizado para operações em DB)
const itemsToCreate: EncomendaItens[] = [];
    let valorTotalRecalculado = 0;

    for (const anonItem of anonItems) {
        // **IMPORTANTE:** Aqui, você deve buscar o preço atual do produto no DB (tabela PRODUTOS)
        // Como o serviço PRODUTOS não existe, vamos usar um valor simulado.
        const simulatedPrice = 4.00; // Substitua pelo preço real do DB
        
        const existingItemIndex = activeCart.itens.findIndex(item => item.produto_id === anonItem.productId);

        if (existingItemIndex !== -1) {
            // Item já existe: ATUALIZA a quantidade
            activeCart.itens[existingItemIndex].quantidade += anonItem.quantity;
            await this.itemRepository.save(activeCart.itens[existingItemIndex]);
        } else {
            // Item novo: Cria o objeto para inserção em lote
            const newItem = this.itemRepository.create({
              encomenda_id: activeCart.id,
              produto_id: anonItem.productId,
              quantidade: anonItem.quantity,
              preco_unitario_congelado: simulatedPrice,
            });
            itemsToCreate.push(newItem);
        }
        
        // Recalcular o valor total
        valorTotalRecalculado += simulatedPrice * anonItem.quantity; 
    }
    
    // Insere todos os novos itens de uma vez
    if (itemsToCreate.length > 0) {
        await this.itemRepository.insert(itemsToCreate);
    }
    
    // 3. Atualiza o valor total da encomenda no DB
    await this.encomendaRepository.update(activeCart.id, { valor_total: valorTotalRecalculado });

    // Retorna o carrinho atualizado
    return this.encomendaRepository.findOne({ 
        where: { id: activeCart.id },
        relations: ['itens'] 
    });
  }
}