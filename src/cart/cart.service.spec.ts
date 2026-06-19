import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CartService } from './cart.service';
import { Encomendas } from '../encomendas/encomendas.entity';
import { EncomendaItens } from '../encomendas/encomenda-itens.entity';
import { Product } from '../products/entities/product.entity';
import { Carrinho } from '../carrinhos/carrinho.entity';
import { Usuarios } from '../users/usuarios.entity';
import { EncomendasCarrinhos } from '../encomendas/encomendas-carrinhos.entity';
import { MailService } from '../mail/mail.service';
import { CalendarService } from '../calendar/calendar.service';
import { ShippingService } from '../shipping/shipping.service';
import { MetodoEntrega, MetodoPagamento, EncomendaStatus } from '../encomendas/encomenda.enums';
import { CheckoutDto } from './dto/checkout.dto';

/** Data no futuro (D+2) no formato YYYY-MM-DD */
function futureDateStr(daysAhead = 2): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

/** Monta o DTO base de checkout válido */
function makeCheckoutDto(overrides: Partial<CheckoutDto> = {}): CheckoutDto {
  return {
    items: [{ productId: 1, quantity: 100 }],
    cartIds: [1],
    dataAgendada: futureDateStr(2),
    horaAgendada: '10:00',
    metodoEntrega: MetodoEntrega.PICKUP,
    metodoPagamento: MetodoPagamento.CARD,
    personalData: {
      fullName: 'Cliente Teste',
      email: 'teste@email.com',
      cpf: '000.000.000-00',
      phone: '34999999999',
      birthDate: '1990-01-01',
    },
    ...overrides,
  };
}

/** Produto mockado com preço 1.00 e id=1 */
const mockProduct = { id: 1, preco_unitario: 1.0 } as Product;

/** Carrinho mockado com capacidade 250 */
const mockCarrinho = { id: 1, capacidade: 250 } as Carrinho;

describe('CartService — finalizeOrder', () => {
  let service: CartService;

  /** manager mockado: cada método retorna o que o teste configurar */
  const mockManager = {
    findOne: jest.fn(),
    find: jest.fn(),
    findBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb(mockManager)),
  };

  const mockShippingService = { calculateShippingFee: jest.fn() };
  const mockMailService    = { sendNewOrderEmails: jest.fn() };
  const mockCalendarService = { createOrderEvent: jest.fn().mockResolvedValue(null) };

  const repoMock = () => ({
    createQueryBuilder: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: getRepositoryToken(Encomendas),          useValue: repoMock() },
        { provide: getRepositoryToken(EncomendaItens),      useValue: repoMock() },
        { provide: getRepositoryToken(Product),             useValue: repoMock() },
        { provide: getRepositoryToken(Carrinho),            useValue: repoMock() },
        { provide: getRepositoryToken(Usuarios),            useValue: repoMock() },
        { provide: getRepositoryToken(EncomendasCarrinhos), useValue: repoMock() },
        { provide: MailService,    useValue: mockMailService },
        { provide: CalendarService, useValue: mockCalendarService },
        { provide: ShippingService, useValue: mockShippingService },
        { provide: DataSource,     useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => jest.clearAllMocks());

  function setupHappyManager() {
    mockManager.findOne.mockImplementation((entity, _opts) => {
      if (entity === Usuarios)   return Promise.resolve(null);
      if (entity === Encomendas) return Promise.resolve({ id: 99, status: EncomendaStatus.PENDENTE, itens: [], carrinhos: [] });
      return Promise.resolve(null);
    });
    mockManager.findBy.mockResolvedValue([mockCarrinho]);
    mockManager.find.mockImplementation((entity) => {
      if (entity === Product)   return Promise.resolve([mockProduct]);
      if (entity === Usuarios)  return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mockManager.create.mockImplementation((_entity, data) => ({ ...data, id: 99, itens: [], carrinhos: [] }));
    mockManager.save.mockImplementation((val) => Promise.resolve(Array.isArray(val) ? val : { ...val, id: 99 }));
    mockManager.update.mockResolvedValue({});
    mockManager.delete.mockResolvedValue({});

    // Garante que checkAvailability sempre reporta o carrinho 1 como disponível
    // (evita falso positivo do teste de colisão 12h nos outros cenários)
    jest.spyOn(service, 'checkAvailability').mockResolvedValue({
      totalAvailable: 1,
      details: [{ id: 1, identificacao: 'C1', cor: 'Azul', capacidade: 250 }],
      byColor: { Azul: 1 },
    });
  }

  // ================================================================
  // 1. TESTE DE FRAUDE FINANCEIRA - adulteração de preço
  // ================================================================
  it('deve recalcular o valor total com base no banco, ignorando o valor do frontend', async () => {
    setupHappyManager();
    // Produto custa R$ 1,00 no banco. 100 unidades = R$ 100.
    // Se o frontend tentasse enviar um valor diferente, o backend recalcula.
    const dto = makeCheckoutDto({ items: [{ productId: 1, quantity: 100 }], cartIds: [1] });

    // Capturar o que foi passado para manager.update na hora de gravar o valorTotal
    let valorTotalGravado: number | null = null;
    mockManager.update.mockImplementation((_entity, _id, data) => {
      if (data?.valorTotal !== undefined) valorTotalGravado = data.valorTotal;
      return Promise.resolve({});
    });

    await service.finalizeOrder(null, dto);

    // 100 picolés × R$ 1.00 = R$ 100,00 (sem desconto, sem frete PICKUP)
    expect(valorTotalGravado).toBe(100);
  });

  // ================================================================
  // 2. TESTE DE FRONTEIRA GEOGRÁFICA - CEP fora de Uberaba
  // ================================================================
  it('deve bloquear checkout e lançar BadRequestException se cidade do endereço não for Uberaba', async () => {
    const dto = makeCheckoutDto({
      metodoEntrega: MetodoEntrega.DELIVERY,
      enderecoCidade: 'Uberlândia', // cidade errada
      enderecoCep: '38400000',
      enderecoLogradouro: 'Rua Teste',
      enderecoNumero: '1',
      enderecoEstado: 'MG',
    });

    await expect(service.finalizeOrder(null, dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  // ================================================================
  // 3. TESTE DE VOLUMETRIA - picolés > capacidade dos carrinhos
  // ================================================================
  it('deve rejeitar o pedido se o total de picolés exceder a capacidade dos carrinhos selecionados', async () => {
    setupHappyManager();

    // 600 picolés mas carrinhos têm capacidade 250 (só 1 carrinho selecionado)
    mockManager.findBy.mockResolvedValue([{ id: 1, capacidade: 250 } as Carrinho]);

    const dto = makeCheckoutDto({
      items: [{ productId: 1, quantity: 600 }],
      cartIds: [1],
    });

    await expect(service.finalizeOrder(null, dto)).rejects.toThrow(BadRequestException);
  });

  // ================================================================
  // 4. TESTE DE INTEGRIDADE DE DADOS - pedido abaixo do mínimo (80)
  // ================================================================
  it('deve falhar se o total de picolés for abaixo do mínimo de 80', async () => {
    setupHappyManager();

    const dto = makeCheckoutDto({
      items: [{ productId: 1, quantity: 50 }], // 50 < 80
    });

    await expect(service.finalizeOrder(null, dto)).rejects.toThrow(
      new BadRequestException('Pedido mínimo de 80 picolés por encomenda.'),
    );
  });

  // ================================================================
  // 5. TESTE DA BARREIRA TEMPORAL - agendamento D+1 (data no passado)
  // ================================================================
  it('deve bloquear pedido se a data de agendamento for hoje ou no passado (regra D+1)', async () => {
    // Usa uma data no passado para garantir que caia na regra de bloqueio independentemente de fuso horário
    const passado = '2000-01-01';
    const dto = makeCheckoutDto({ dataAgendada: passado });

    await expect(service.finalizeOrder(null, dto)).rejects.toThrow(
      new BadRequestException('O agendamento deve ser para no mínimo o dia seguinte (D+1).'),
    );
  });

  // ================================================================
  // 6. TESTE DE COLISÃO LOGÍSTICA - carrinho indisponível (12h)
  // ================================================================
  it('deve rejeitar locação se o carrinho selecionado não estiver disponível no horário (conflito 12h)', async () => {
    setupHappyManager();

    // checkAvailability retorna lista de disponíveis vazia (carrinho ID=1 ocupado)
    jest.spyOn(service, 'checkAvailability').mockResolvedValueOnce({
      totalAvailable: 0,
      details: [], // carrinho 1 não aparece = está ocupado
      byColor: {},
    });

    const dto = makeCheckoutDto({ cartIds: [1] });

    await expect(service.finalizeOrder(null, dto)).rejects.toThrow(BadRequestException);
  });

  // ================================================================
  // 7. TESTE DE LÓGICA DE PAGAMENTO - desconto PIX x CARD
  // ================================================================
  it('deve aplicar 10% de desconto para PIX e não aplicar para CARD', async () => {
    // Teste PIX
    setupHappyManager();
    const gravados: number[] = [];
    mockManager.update.mockImplementation((_e, _id, data) => {
      if (data?.valorDesconto !== undefined) gravados.push(data.valorDesconto);
      return Promise.resolve({});
    });

    const dtoPix = makeCheckoutDto({ metodoPagamento: MetodoPagamento.PIX });
    await service.finalizeOrder(null, dtoPix);
    // 100 picolés × R$1 = R$100 → desconto 10% = R$10
    expect(gravados[0]).toBeCloseTo(10, 1);

    // Teste CARD
    jest.clearAllMocks();
    setupHappyManager();
    const gravadosCard: number[] = [];
    mockManager.update.mockImplementation((_e, _id, data) => {
      if (data?.valorDesconto !== undefined) gravadosCard.push(data.valorDesconto);
      return Promise.resolve({});
    });

    const dtoCard = makeCheckoutDto({ metodoPagamento: MetodoPagamento.CARD });
    await service.finalizeOrder(null, dtoCard);
    expect(gravadosCard[0]).toBe(0);
  });

  // ================================================================
  // 8. TESTE DE PROTEÇÃO LEGAL - maioridade
  // ================================================================
  it('deve impedir finalização se o cliente tiver menos de 18 anos', async () => {
    const menorData = new Date();
    menorData.setFullYear(menorData.getFullYear() - 17); // 17 anos
    const birthDate = menorData.toISOString().split('T')[0];

    const dto = makeCheckoutDto({
      personalData: {
        fullName: 'Cliente Menor',
        email: 'menor@email.com',
        cpf: '000.000.000-00',
        phone: '34999999999',
        birthDate,
      },
    });

    await expect(service.finalizeOrder(null, dto)).rejects.toThrow(
      new BadRequestException('É necessário ter 18 anos ou mais para realizar um pedido.'),
    );
  });
});
