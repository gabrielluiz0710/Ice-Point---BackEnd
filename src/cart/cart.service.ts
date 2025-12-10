import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Not,
  DataSource,
  In,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { CartItemDto } from './dto/cart-transfer.dto';
import { Encomendas } from '../encomendas/encomendas.entity';
import { EncomendaItens } from '../encomendas/encomenda-itens.entity';
import { Product } from '../products/entities/product.entity';
import { Carrinho } from '../carrinhos/carrinho.entity';
import { Usuarios } from '../users/usuarios.entity';
import { EncomendaStatus, MetodoEntrega, MetodoPagamento } from '../encomendas/encomenda.enums'; 
import { CheckoutDto } from './dto/checkout.dto';
import { EncomendasCarrinhos } from '../encomendas/encomendas-carrinhos.entity'; 

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
    @InjectRepository(Usuarios)
    private readonly usuarioRepository: Repository<Usuarios>,
    @InjectRepository(EncomendasCarrinhos)
    private readonly encomendasCarrinhosRepository: Repository<EncomendasCarrinhos>,
    private readonly dataSource: DataSource,
  ) {}

  async getActiveCart(userId: string) {
    return this.encomendaRepository.findOne({
      where: { clienteId: userId, status: 'PENDENTE' as any },
      relations: ['itens', 'itens.produto'],
    });
  }

  async transferAnonCart(userId: string, anonItems: CartItemDto[]) {
    return this.syncCart(userId, anonItems);
  }

  async syncCart(userId: string, items: CartItemDto[]) {
    return await this.dataSource.transaction(async (manager) => {
      let activeCart = await manager.findOne(Encomendas, {
        where: { clienteId: userId, status: 'PENDENTE' as any },
        relations: ['itens'],
      });

      if (!activeCart) {
        activeCart = manager.create(Encomendas, {
          clienteId: userId,
          status: 'PENDENTE' as any,
          valorTotal: 0.0,
          itens: [],
        });
        activeCart = await manager.save(activeCart);
      }

      const validItems = items.filter((i) => i.quantity > 0);
      let novoValorTotal = 0;

      if (activeCart.itens && activeCart.itens.length > 0) {
        await manager.delete(EncomendaItens, { encomendaId: activeCart.id });
      }

      const itensParaSalvar: EncomendaItens[] = [];

      for (const itemDto of validItems) {
        const produto = await manager.findOne(Product, {
          where: { id: itemDto.productId },
        });
        const preco = produto ? Number(produto.preco_unitario) : 0;

        const novoItem = manager.create(EncomendaItens, {
          encomenda: { id: activeCart.id },
          produto: { id: itemDto.productId },
          quantidade: itemDto.quantity,
          precoUnitarioCongelado: preco,
        });

        itensParaSalvar.push(novoItem);
        novoValorTotal += preco * itemDto.quantity;
      }

      if (itensParaSalvar.length > 0) {
        await manager.save(itensParaSalvar);
      }

      await manager.update(Encomendas, activeCart.id, {
        valorTotal: novoValorTotal,
      });

      return { success: true, cartId: activeCart.id };
    });
  }

  async checkAvailability(dateString: string) {
    const targetDate = new Date(dateString);

    if (isNaN(targetDate.getTime())) {
      throw new Error('Data inválida fornecida.');
    }

    const windowStart = new Date(targetDate);
    windowStart.setDate(targetDate.getDate() - 1);
    windowStart.setHours(0, 0, 0, 0);

    const windowEnd = new Date(targetDate);
    windowEnd.setDate(targetDate.getDate() + 1);
    windowEnd.setHours(23, 59, 59, 999);

    const busyCarts = await this.encomendasCarrinhosRepository
      .createQueryBuilder('ec')
      .innerJoin('ec.encomenda', 'e')
      .select('ec.carrinhoId')
      .where('e.status != :status', { status: EncomendaStatus.CANCELADO })
      .andWhere('e.data_agendada >= :start', { start: windowStart.toISOString().split('T')[0] })
      .andWhere('e.data_agendada <= :end', { end: windowEnd.toISOString().split('T')[0] })
      .getMany();

    const busyCartIds = busyCarts.map((bc) => bc.carrinhoId);

    const queryBuilder = this.carrinhoRepository.createQueryBuilder('c');
    
    queryBuilder.where('c.status = :statusCarrinho', { statusCarrinho: 'DISPONIVEL' });

    if (busyCartIds.length > 0) {
      queryBuilder.andWhere('c.id NOT IN (:...busyIds)', { busyIds: busyCartIds });
    }

    const availableCarts = await queryBuilder.getMany();

    const summary = {
      totalAvailable: availableCarts.length,
      details: availableCarts.map((c) => ({
        id: c.id,
        identificacao: c.identificacao,
        cor: c.cor,
        capacidade: c.capacidade,
      })),
      byColor: availableCarts.reduce((acc, curr) => {
        const cor = curr.cor || 'Sem Cor';
        acc[cor] = (acc[cor] || 0) + 1;
        return acc;
      }, {}),
    };

    return summary;
  }

  async finalizeOrder(userId: string | null, dto: CheckoutDto) {
    return await this.dataSource.transaction(async (manager) => {
      let usuario: Usuarios | null = null;
      let activeCart: Encomendas | null = null;

      if (userId) {
        usuario = await manager.findOne(Usuarios, { where: { id: userId } });
        if (!usuario) throw new NotFoundException('Usuário não encontrado.');

        activeCart = await manager.findOne(Encomendas, {
          where: { clienteId: userId, status: EncomendaStatus.PENDENTE },
        });
      }

      if (!activeCart) {
        activeCart = manager.create(Encomendas, {
          clienteId: userId ?? undefined, 
          status: EncomendaStatus.PENDENTE,
          itens: [],
        });
      }

      const finalCart = activeCart!;

      if (finalCart.id) {
        await manager.delete(EncomendaItens, { encomendaId: finalCart.id });
      }

      const personalData = dto.personalData || {};

      finalCart.nomeCliente = personalData.fullName || usuario?.nome || 'Cliente Convidado';
      finalCart.emailCliente = personalData.email || usuario?.email || '';
      finalCart.telefoneCliente = personalData.phone || usuario?.telefone || '';
      finalCart.cpfCliente = personalData.cpf || usuario?.cpf || '';

      if (personalData.birthDate) {
        finalCart.dataNascimentoCliente = personalData.birthDate;
      } else if (usuario?.data_nascimento) {
        finalCart.dataNascimentoCliente = usuario.data_nascimento.toString();
      }

      finalCart.dataAgendada = dto.dataAgendada;
      finalCart.horaAgendada = dto.horaAgendada;
      finalCart.metodoEntrega = dto.metodoEntrega;
      finalCart.metodoPagamento = dto.metodoPagamento;

      if (dto.enderecoCep) finalCart.enderecoCep = dto.enderecoCep;
      if (dto.enderecoLogradouro) finalCart.enderecoLogradouro = dto.enderecoLogradouro;
      if (dto.enderecoNumero) finalCart.enderecoNumero = dto.enderecoNumero;
      if (dto.enderecoComplemento) finalCart.enderecoComplemento = dto.enderecoComplemento;
      if (dto.enderecoBairro) finalCart.enderecoBairro = dto.enderecoBairro;
      if (dto.enderecoCidade) finalCart.enderecoCidade = dto.enderecoCidade;
      if (dto.enderecoEstado) finalCart.enderecoEstado = dto.enderecoEstado;

      if (dto.metodoPagamento === MetodoPagamento.ONLINE) {
        finalCart.status = EncomendaStatus.AGUARDANDO_PAGAMENTO;
      } else {
        finalCart.status = EncomendaStatus.CONFIRMADO;
      }

      if (dto.cartIds && dto.cartIds.length > 0) {
        const carrinhosSelecionados = await manager.findBy(Carrinho, {
          id: In(dto.cartIds),
        });
        if (carrinhosSelecionados.length !== dto.cartIds.length) {
          throw new BadRequestException('Um ou mais carrinhos selecionados são inválidos.');
        }
        finalCart.carrinhos = carrinhosSelecionados;
      }

      activeCart = await manager.save(finalCart);
      
      const savedCart = activeCart;

      const itemsMap = new Map<number, number>();
      dto.items.forEach((item) => {
        if (item.quantity > 0) {
          const currentQty = itemsMap.get(item.productId) || 0;
          itemsMap.set(item.productId, currentQty + item.quantity);
        }
      });

      const itensParaSalvar: EncomendaItens[] = [];
      let somaProdutos = 0;

      for (const [productId, quantity] of itemsMap.entries()) {
        const produto = await manager.findOne(Product, { where: { id: productId } });
        const preco = produto ? Number(produto.preco_unitario) : 0;

        const novoItem = manager.create(EncomendaItens, {
          encomenda: { id: savedCart.id },
          produto: { id: productId },
          quantidade: quantity,
          precoUnitarioCongelado: preco,
        });

        itensParaSalvar.push(novoItem);
        somaProdutos += preco * quantity;
      }

      if (itensParaSalvar.length > 0) {
        await manager.save(itensParaSalvar);
      }

      let taxaEntrega = 0;
      if (savedCart.metodoEntrega === MetodoEntrega.DELIVERY) {
        taxaEntrega = 20.00;
      }

      let valorDesconto = 0;
      if (
        savedCart.metodoPagamento === MetodoPagamento.PIX ||
        savedCart.metodoPagamento === MetodoPagamento.CASH
      ) {
        valorDesconto = somaProdutos * 0.10;
      }

      const valorTotalFinal = somaProdutos + taxaEntrega - valorDesconto;

      await manager.update(Encomendas, savedCart.id, {
        valorProdutos: somaProdutos,
        taxaEntrega: taxaEntrega,
        valorDesconto: valorDesconto,
        valorTotal: valorTotalFinal,
        status: savedCart.status
      });

      return {
        success: true,
        orderId: savedCart.id,
        status: savedCart.status,
        valores: {
          produtos: somaProdutos,
          entrega: taxaEntrega,
          desconto: valorDesconto,
          total: valorTotalFinal
        },
        message: 'Pedido realizado com sucesso!',
      };
    });
  }
}