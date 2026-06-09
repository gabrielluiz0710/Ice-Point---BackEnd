import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encomendas } from '../encomendas/encomendas.entity';

@Injectable()
export class PaymentService {
  private client: MercadoPagoConfig;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Encomendas)
    private readonly encomendaRepository: Repository<Encomendas>,
  ) {
    const accessToken =
      this.configService.get<string>('MERCADO_PAGO_ACCESS_TOKEN') ?? '';

    this.client = new MercadoPagoConfig({
      accessToken: accessToken,
    });
  }

  async createPreference(orderData: any) {
    try {
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ??
        'https://www.icepoint.com.br';

      // Busca o pedido e os preços DIRETAMENTE do banco
      const orderId = orderData.orderId;
      if (!orderId) {
        throw new NotFoundException('orderId é obrigatório.');
      }

      const order = await this.encomendaRepository.findOne({
        where: { id: orderId },
        relations: ['itens', 'itens.produto'],
      });

      if (!order) {
        throw new NotFoundException(`Pedido ${orderId} não encontrado.`);
      }

      const preference = new Preference(this.client);

      // Usa os preços congelados no momento do checkout
      const items = order.itens.map((item) => ({
        id: String(item.produto?.id ?? item.id),
        title: item.produto?.nome ?? 'Produto Ice Point',
        quantity: Number(item.quantidade),
        unit_price: Number(item.precoUnitarioCongelado),
      }));

      // Taxa de entrega do banco
      const deliveryFee = Number(order.taxaEntrega ?? 0);
      if (deliveryFee > 0) {
        items.push({
          id: 'delivery',
          title: 'Taxa de Entrega',
          quantity: 1,
          unit_price: deliveryFee,
        });
      }

      // Desconto registrado no banco
      if (order.valorDesconto && Number(order.valorDesconto) > 0) {
        items.push({
          id: 'desconto',
          title: 'Desconto aplicado',
          quantity: 1,
          unit_price: -Number(order.valorDesconto),
        });
      }

      const body = {
        items: items,
        payer: {
          email: orderData.buyer?.email ?? order.emailCliente,
          name: orderData.buyer?.fullName ?? order.nomeCliente,
          identification: {
            type: 'CPF',
            number: (orderData.buyer?.cpf ?? order.cpfCliente ?? '').replace(
              /\D/g,
              '',
            ),
          },
        },
        back_urls: {
          success: `${frontendUrl}/pedido-confirmado`,
          failure: `${frontendUrl}/erro-pagamento`,
          pending: `${frontendUrl}/pagamento-pendente`,
        },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [{ id: 'ticket' }],
          installments: 1,
        },
        external_reference: String(orderId),
        statement_descriptor: 'ICE POINT',
      };

      const result = await preference.create({ body });

      return {
        checkoutUrl: result.init_point,
        id: result.id,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('Erro ao criar preferência MP:', error);
      throw new InternalServerErrorException('Erro ao processar pagamento');
    }
  }
}

