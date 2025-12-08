import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm'; 
import { CartItemDto } from './dto/cart-transfer.dto';
import { Encomendas } from '../encomendas/encomendas.entity';
import { EncomendaItens } from '../encomendas/encomenda-itens.entity';
// Importe a entidade Produtos para pegar o preço real
import { Product } from '../products/entities/product.entity'; 

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Encomendas)
    private readonly encomendaRepository: Repository<Encomendas>,
    @InjectRepository(EncomendaItens)
    private readonly itemRepository: Repository<EncomendaItens>,
    @InjectRepository(Product) // Injete o repositório de produtos
    private readonly produtoRepository: Repository<Product>,
  ) {}

  // Busca carrinho existente
  async getActiveCart(userId: string) {
    return this.encomendaRepository.findOne({
      where: { cliente_id: userId, status: 'PENDENTE' as any },
      relations: ['itens'], 
    });
  }

  // Lógica de Transferência (Mantida, mas simplificada para usar o sync)
  async transferAnonCart(userId: string, anonItems: CartItemDto[]) {
    // Apenas chama o sync, pois a lógica é a mesma: o que vem do front prevalece ou soma
    return this.syncCart(userId, anonItems);
  }

  // Lógica Principal: Salvar Carrinho
  async syncCart(userId: string, items: CartItemDto[]) {
    // 1. Busca ou cria a encomenda PENDENTE
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

    // 2. Limpa itens zerados que podem ter vindo (segurança)
    const validItems = items.filter(i => i.quantity > 0);

    // 3. Processa os itens
    let novoValorTotal = 0;

    // Removemos todos os itens antigos para recriar com base no estado atual do Front
    // (Estratégia mais segura para evitar desync). 
    // Se quiser performance extrema em escala gigantesca, faria diff, mas para e-commerce normal, delete/insert é ok.
    if (activeCart.itens && activeCart.itens.length > 0) {
        await this.itemRepository.delete({ encomenda_id: activeCart.id });
    }

    const itensParaSalvar: EncomendaItens[] = [];

    for (const itemDto of validItems) {
        // Busca preço atual do produto no banco
        const produto = await this.produtoRepository.findOne({ where: { id: itemDto.productId } });
        const preco = produto ? Number(produto.preco_unitario) : 0;

        const novoItem = this.itemRepository.create({
            encomenda_id: activeCart.id,
            produto_id: itemDto.productId,
            quantidade: itemDto.quantity,
            preco_unitario_congelado: preco // Salva o preço do momento
        });

        itensParaSalvar.push(novoItem);
        novoValorTotal += preco * itemDto.quantity;
    }

    // Salva tudo
    if (itensParaSalvar.length > 0) {
        await this.itemRepository.save(itensParaSalvar);
    }

    // Atualiza valor total da encomenda
    await this.encomendaRepository.update(activeCart.id, { valor_total: novoValorTotal });

    return { success: true, cartId: activeCart.id };
  }
}