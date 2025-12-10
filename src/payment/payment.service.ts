import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Preference } from 'mercadopago';

@Injectable()
export class PaymentService {
    private client: MercadoPagoConfig;

    constructor(private configService: ConfigService) {
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

            const preference = new Preference(this.client);

            const items = orderData.items.map((item) => ({
                id: item.color,
                title: `Carrinho de Picolé - ${item.color}`,
                quantity: Number(item.quantity),
                unit_price: Number(item.unitPrice || 0),
            }));

            if (orderData.deliveryFee > 0) {
                items.push({
                    id: 'delivery',
                    title: 'Taxa de Entrega',
                    quantity: 1,
                    unit_price: Number(orderData.deliveryFee),
                });
            }

            const body = {
                items: items,
                payer: {
                    email: orderData.buyer.email,
                    name: orderData.buyer.fullName,
                    identification: {
                        type: 'CPF',
                        number: orderData.buyer.cpf.replace(/\D/g, ''),
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
                external_reference: orderData.orderId,
                statement_descriptor: 'ICE POINT',
            };

            const result = await preference.create({ body });

            return {
                checkoutUrl: result.init_point,
                id: result.id,
            };
        } catch (error) {
            console.error('Erro ao criar preferência MP:', error);
            throw new InternalServerErrorException('Erro ao processar pagamento');
        }
    }
}
