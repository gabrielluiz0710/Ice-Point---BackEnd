import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { Encomendas } from '../encomendas/encomendas.entity';
import { MetodoEntrega } from '../encomendas/encomenda.enums';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as sharp from 'sharp';

const CART_IMAGES: Record<string, string> = {
    azul: 'https://db.icepoint.com.br/storage/v1/object/public/images/carrinhos/azul.webp',
    rosa: 'https://db.icepoint.com.br/storage/v1/object/public/images/carrinhos/rosa.webp',
    'azul/rosa':
        'https://db.icepoint.com.br/storage/v1/object/public/images/carrinhos/misto.webp',
    misto:
        'https://db.icepoint.com.br/storage/v1/object/public/images/carrinhos/misto.webp',
    default:
        'https://db.icepoint.com.br/storage/v1/object/public/images/carrinhos/misto.webp',
};

const LOGO_FULL = 'https://www.icepoint.com.br/assets/logo_full-CTT1BAul.png';
const LOGO_WHITE =
    'https://www.icepoint.com.br/assets/logo_branca-trhWD2Xw.png';
const LINK_PERFIL = 'https://www.icepoint.com.br/perfil';

@Injectable()
export class MailService {
    private resend: Resend;
    private supabase: SupabaseClient;
    private logger = new Logger(MailService.name);

    constructor() {
        this.resend = new Resend(process.env.RESEND_KEY);
        this.supabase = createClient(
            process.env.SUPABASE_URL ?? '',
            process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
        );
    }

    private async ensurePngUrl(originalUrl: string): Promise<string> {
        if (!originalUrl)
            return 'https://cdn-icons-png.flaticon.com/512/938/938063.png';

        if (!originalUrl.toLowerCase().endsWith('.webp')) {
            return originalUrl;
        }

        try {
            const pngUrl = originalUrl.replace(/\.webp$/i, '.png');

            const checkResponse = await fetch(pngUrl, { method: 'HEAD' });
            if (checkResponse.ok) {
                return pngUrl;
            }

            const bucketName = 'images';
            const publicMarker = `/storage/v1/object/public/${bucketName}/`;

            if (!originalUrl.includes(publicMarker)) {
                return originalUrl;
            }

            const path = originalUrl.split(publicMarker)[1];
            const newPath = path.replace(/\.webp$/i, '.png');

            const imageResponse = await fetch(originalUrl);
            if (!imageResponse.ok) throw new Error('Falha ao baixar imagem original');
            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const pngBuffer = await sharp(buffer)
                .png({ quality: 80, compressionLevel: 8 })
                .toBuffer();

            const { error } = await this.supabase.storage
                .from(bucketName)
                .upload(newPath, pngBuffer, {
                    contentType: 'image/png',
                    upsert: true,
                });

            if (error) {
                this.logger.error(`Erro ao subir PNG para o storage: ${error.message}`);
                return originalUrl;
            }

            const { data } = this.supabase.storage
                .from(bucketName)
                .getPublicUrl(newPath);
            this.logger.log(`Imagem convertida com sucesso: ${data.publicUrl}`);
            return data.publicUrl;
        } catch (error) {
            this.logger.error(`Erro ao converter imagem ${originalUrl}:`, error);
            return originalUrl;
        }
    }

    private formatCurrency(value: number): string {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    }

    private formatDate(dateStr: string): string {
        if (!dateStr) return '';

        const date = new Date(dateStr);

        return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
    }

    private getCartImage(color: string): string {
        if (!color) return CART_IMAGES['default'];

        const normalizedColor = color.toLowerCase().trim();

        return CART_IMAGES[normalizedColor] || CART_IMAGES['default'];
    }

    private getCartImageUrl(color: string): string {
        if (!color) return CART_IMAGES['default'];
        const normalizedColor = color.toLowerCase().trim();
        return CART_IMAGES[normalizedColor] || CART_IMAGES['default'];
    }

    private generateProgressBar(status: string): string {
        const activeColor = '#0070f3';
        const inactiveColor = '#e0e0e0';

        return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
        <tr>
          <td align="center" width="25%">
            <div style="width: 20px; height: 20px; background-color: ${activeColor}; border-radius: 50%; margin-bottom: 5px;"></div>
            <span style="font-size: 10px; color: ${activeColor}; font-weight: bold;">Solicitado</span>
          </td>
          <td align="center" width="25%">
            <div style="width: 20px; height: 20px; background-color: ${activeColor}; border-radius: 50%; margin-bottom: 5px;"></div>
            <span style="font-size: 10px; color: ${activeColor}; font-weight: bold;">Confirmado</span>
          </td>
          <td align="center" width="25%">
            <div style="width: 20px; height: 20px; background-color: ${inactiveColor}; border-radius: 50%; margin-bottom: 5px;"></div>
            <span style="font-size: 10px; color: #999;">Preparação</span>
          </td>
          <td align="center" width="25%">
            <div style="width: 20px; height: 20px; background-color: ${inactiveColor}; border-radius: 50%; margin-bottom: 5px;"></div>
            <span style="font-size: 10px; color: #999;">Festa!</span>
          </td>
        </tr>
        <tr>
          <td colspan="4" style="padding-top: 5px;">
             <div style="height: 4px; background: linear-gradient(to right, ${activeColor} 50%, ${inactiveColor} 50%); border-radius: 2px; width: 80%; margin: 0 auto;"></div>
          </td>
        </tr>
      </table>
    `;
    }

    private generateOrderTemplate(
        order: Encomendas,
        isClient: boolean,
        processedImages: { products: Record<number, string>, carts: Record<number, string> }
    ): string {
        const isDelivery = order.metodoEntrega === MetodoEntrega.DELIVERY;
        const title = isClient ? 'A festa vai começar! 🥳' : '🔔 Novo Pedido Recebido';
        const subTitle = isClient ? 'Seu pedido foi confirmado com sucesso.' : `Pedido #${order.id} realizado.`;

        const productsHtml = order.itens
            .map((item) => {
                const imgUrl = processedImages.products[item.produto.id] ||
                    (item.produto as any)?.imagemCapa ||
                    'https://cdn-icons-png.flaticon.com/512/938/938063.png';

                return `
      <tr>
        <td width="70" style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">
          <img src="${imgUrl}" alt="${item.produto?.nome}" width="60" style="width: 60px; height: auto; border-radius: 8px; display: block; margin: 0 auto;">
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">
          <strong style="color: #333; font-size: 14px;">${item.produto?.nome || 'Produto Premium'}</strong>
        </td>
        <td style="padding: 10px; text-align: center; color: #666; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">x${item.quantidade}</td>
        <td style="padding: 10px; text-align: right; font-weight: 600; color: #333; border-bottom: 1px solid #f0f0f0; vertical-align: middle;">${this.formatCurrency(Number(item.precoUnitarioCongelado))}</td>
      </tr>
    `;
            })
            .join('');

        const cartsHtml =
            order.carrinhos && order.carrinhos.length > 0
                ? `
        <div style="background-color: #f8faff; border: 1px dashed #0070f3; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
          <p style="margin: 0 0 15px 0; color: #0070f3; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Carrinho(s) da Festa</p>
          ${order.carrinhos
                    .map((c) => {
                        const cartImgUrl = processedImages.carts[c.id] || this.getCartImageUrl(c.cor);
                        return `
            <div style="display: inline-block; margin: 0 10px; vertical-align: top; width: 120px;">
              <img src="${cartImgUrl}" alt="Carrinho ${c.cor}" width="120" style="width: 120px; height: auto; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: block; margin: 0 auto;">
              <p style="font-size: 12px; color: #555; margin-top: 8px; text-transform: capitalize;"><strong>Cor: ${c.cor || 'Padrão'}</strong></p>
            </div>
          `})
                    .join('')}
        </div>
      `
                : '';

        const addressHtml = isDelivery
            ? `
        <div style="background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 20px; margin-top: 20px; display: flex; align-items: center;">
          <div style="width: 100%;">
            <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">📍 Onde vamos entregar</h3>
            <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
              ${order.enderecoLogradouro}, ${order.enderecoNumero} ${order.enderecoComplemento ? '- ' + order.enderecoComplemento : ''}<br>
              ${order.enderecoBairro}, ${order.enderecoCidade} - ${order.enderecoEstado}<br>
              <span style="color: #999; font-size: 12px;">CEP: ${order.enderecoCep}</span>
            </p>
          </div>
        </div>
      `
            : `
        <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 12px; padding: 20px; margin-top: 20px; text-align: center;">
          <img src="https://cdn-icons-png.flaticon.com/512/709/709790.png" width="40" style="opacity: 0.8; margin-bottom: 10px;">
          <h3 style="margin: 0; color: #1565c0;">Retirada na Loja</h3>
          <p style="margin: 5px 0 0 0; color: #1e88e5; font-size: 14px;">Seu pedido estará te esperando!</p>
        </div>
      `;

        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: 'Poppins', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                <tr>
                  <td style="background-color: #1a1a2e; padding: 40px 20px; text-align: center;">
                    <img src="${LOGO_WHITE}" alt="Ice Point" width="180" style="display: block; margin: 0 auto;">
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h1 style="color: #1a1a2e; font-size: 24px; margin: 0 0 10px 0;">${title}</h1>
                      <p style="color: #7f8c8d; font-size: 16px; margin: 0;">${subTitle}</p>
                      <div style="margin-top: 5px; font-weight: bold; background: #e8f5e9; color: #2e7d32; display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px;">PEDIDO #${order.id}</div>
                    </div>

                    ${this.generateProgressBar(order.status)}

                    <div style="background-color: #fafafa; border-radius: 12px; padding: 15px; text-align: center; margin-bottom: 25px;">
                      <p style="margin: 0; color: #555; font-size: 14px;">
                        📅 <strong>Data da Festa:</strong> ${this.formatDate(order.dataAgendada)} às ${order.horaAgendada}<br>
                        👤 <strong>Cliente:</strong> ${order.nomeCliente}
                      </p>
                    </div>

                    ${cartsHtml}

                    <h3 style="color: #1a1a2e; font-size: 18px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-top: 30px;">🛒 Seus Escolhidos</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${productsHtml}
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                      <tr>
                        <td align="right" style="padding-top: 10px;">
                          <p style="margin: 5px 0; color: #777; font-size: 14px;">Subtotal: ${this.formatCurrency(Number(order.valorProdutos))}</p>
                          <p style="margin: 5px 0; color: #777; font-size: 14px;">Frete: ${this.formatCurrency(Number(order.taxaEntrega))}</p>
                          ${Number(order.valorDesconto) > 0 ? `<p style="margin: 5px 0; color: #2ecc71; font-weight: bold; font-size: 14px;">Desconto: - ${this.formatCurrency(Number(order.valorDesconto))}</p>` : ''}
                          <p style="margin: 15px 0 0 0; color: #1a1a2e; font-size: 22px; font-weight: 700;">${this.formatCurrency(Number(order.valorTotal))}</p>
                        </td>
                      </tr>
                    </table>

                    ${addressHtml}

                    <div style="text-align: center; margin-top: 40px;">
                      <a href="${LINK_PERFIL}" style="background-color: #0070f3; color: #ffffff; text-decoration: none; padding: 15px 35px; border-radius: 50px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(0, 112, 243, 0.3);">
                        Acompanhar meu Pedido 🚀
                      </a>
                      <p style="font-size: 12px; color: #999; margin-top: 15px;">Acesse "Meus Pedidos" para ver detalhes.</p>
                    </div>

                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                     <img src="${LOGO_FULL}" alt="Ice Point Logo" width="80" style="opacity: 0.7; margin-bottom: 10px;">
                     <p style="font-size: 12px; color: #aaa; margin: 0;">Feito com 💜 para deixar sua festa incrível.</p>
                     <p style="font-size: 12px; color: #ccc; margin: 5px 0 0 0;">© ${new Date().getFullYear()} Ice Point. Todos os direitos reservados.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    }

    private generateCancellationTemplate(order: Encomendas, isClient: boolean): string {
        const isDelivery = order.metodoEntrega === MetodoEntrega.DELIVERY;

        const title = isClient ? 'Poxa, pedido cancelado 😕' : '⚠️ Pedido Cancelado';
        const subTitle = isClient
            ? 'Seu pedido foi cancelado. Veja os detalhes abaixo.'
            : `O Pedido #${order.id} foi cancelado no sistema.`;

        const addressHtml = isDelivery
            ? `
        <div style="background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 20px; margin-top: 20px; display: flex; align-items: center;">
          <div style="width: 100%;">
            <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 16px;">📍 Endereço que seria entregue</h3>
            <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
              ${order.enderecoLogradouro}, ${order.enderecoNumero} ${order.enderecoComplemento ? '- ' + order.enderecoComplemento : ''}<br>
              ${order.enderecoBairro}, ${order.enderecoCidade} - ${order.enderecoEstado}<br>
              <span style="color: #999; font-size: 12px;">CEP: ${order.enderecoCep}</span>
            </p>
          </div>
        </div>
      `
            : `
        <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 12px; padding: 20px; margin-top: 20px; text-align: center;">
          <img src="https://cdn-icons-png.flaticon.com/512/709/709790.png" width="40" style="opacity: 0.8; margin-bottom: 10px;">
          <h3 style="margin: 0; color: #1565c0;">Era para Retirada</h3>
          <p style="margin: 5px 0 0 0; color: #1e88e5; font-size: 14px;">Retirada na loja Ice Point</p>
        </div>
      `;

        const reasonHtml = order.motivoCancelamento ? `
            <div style="background-color: #ffebee; border-left: 4px solid #ef5350; border-radius: 4px; padding: 15px; margin: 20px 0; text-align: left;">
                <p style="margin: 0; color: #c62828; font-weight: bold; font-size: 14px;">Motivo do Cancelamento:</p>
                <p style="margin: 5px 0 0 0; color: #b71c1c; font-size: 14px;">"${order.motivoCancelamento}"</p>
            </div>
        ` : '';

        return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f7; font-family: 'Poppins', sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
                
                <tr>
                  <td style="background-color: #1a1a2e; padding: 40px 20px; text-align: center;">
                    <img src="${LOGO_WHITE}" alt="Ice Point" width="180" style="display: block; margin: 0 auto;">
                  </td>
                </tr>

                <tr>
                  <td style="padding: 40px 30px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <h1 style="color: #c0392b; font-size: 24px; margin: 0 0 10px 0;">${title}</h1>
                      <p style="color: #7f8c8d; font-size: 16px; margin: 0;">${subTitle}</p>
                      <div style="margin-top: 10px; font-weight: bold; background: #ffebee; color: #c62828; display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px;">PEDIDO #${order.id}</div>
                    </div>

                    ${reasonHtml}

                    <div style="background-color: #fafafa; border-radius: 12px; padding: 15px; text-align: center; margin-bottom: 25px;">
                      <p style="margin: 0; color: #555; font-size: 14px;">
                        📅 <strong>Data Agendada:</strong> ${this.formatDate(order.dataAgendada)} às ${order.horaAgendada}<br>
                        👤 <strong>Cliente:</strong> ${order.nomeCliente}
                      </p>
                    </div>

                    <h3 style="color: #1a1a2e; font-size: 18px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px; margin-top: 30px;">💰 Resumo de Valores</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 10px;">
                      <tr>
                        <td align="right" style="padding-top: 10px;">
                          <p style="margin: 5px 0; color: #777; font-size: 14px;">Valor dos Produtos: ${this.formatCurrency(Number(order.valorProdutos))}</p>
                          <p style="margin: 5px 0; color: #777; font-size: 14px;">Frete: ${this.formatCurrency(Number(order.taxaEntrega))}</p>
                          ${Number(order.valorDesconto) > 0 ? `<p style="margin: 5px 0; color: #2ecc71; font-weight: bold; font-size: 14px;">Desconto: - ${this.formatCurrency(Number(order.valorDesconto))}</p>` : ''}
                          
                          <div style="margin-top: 15px; border-top: 1px dashed #ddd; padding-top: 10px;">
                             <p style="margin: 0; color: #1a1a2e; font-size: 22px; font-weight: 700;">Total: ${this.formatCurrency(Number(order.valorTotal))}</p>
                             <p style="font-size: 11px; color: #999; margin-top: 5px;">Forma de Pagamento: ${order.metodoPagamento}</p>
                          </div>
                        </td>
                      </tr>
                    </table>

                    ${addressHtml}

                    <div style="text-align: center; margin-top: 40px;">
                      <a href="https://wa.me/5534999658035" style="background-color: #25D366; color: #ffffff; text-decoration: none; padding: 15px 35px; border-radius: 50px; font-weight: bold; display: inline-block; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);">
                        Falar com Suporte 💬
                      </a>
                      <p style="font-size: 12px; color: #999; margin-top: 15px;">Dúvidas sobre reembolso ou reagendamento?</p>
                    </div>

                  </td>
                </tr>

                <tr>
                  <td style="background-color: #f8f8f8; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                     <img src="${LOGO_FULL}" alt="Ice Point Logo" width="80" style="opacity: 0.7; margin-bottom: 10px;">
                     <p style="font-size: 12px; color: #aaa; margin: 0;">Ice Point Sorveteria</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
    }

    async sendNewOrderEmails(order: Encomendas, adminEmails: string[]) {
        try {
            this.logger.log(`Preparando imagens para o pedido #${order.id}...`);

            const processedImages = {
                products: {} as Record<number, string>,
                carts: {} as Record<number, string>
            };

            const productPromises = order.itens.map(async (item) => {
                const original = (item.produto as any)?.imagemCapa;
                if (original) {
                    const pngUrl = await this.ensurePngUrl(original);
                    processedImages.products[item.produto.id] = pngUrl;
                }
            });

            const cartPromises = (order.carrinhos || []).map(async (cart) => {
                const original = this.getCartImageUrl(cart.cor);
                const pngUrl = await this.ensurePngUrl(original);
                processedImages.carts[cart.id] = pngUrl;
            });

            await Promise.all([...productPromises, ...cartPromises]);

            this.logger.log('Imagens processadas/convertidas para PNG com sucesso.');

            if (order.emailCliente) {
                await this.resend.emails.send({
                    from: 'Ice Point <pedidos@icepoint.com.br>',
                    to: [order.emailCliente],
                    subject: `Sua festa foi confirmada! Pedido #${order.id} 🍦`,
                    html: this.generateOrderTemplate(order, true, processedImages),
                });
                this.logger.log(`Email enviado para cliente: ${order.emailCliente}`);
            }

            if (adminEmails.length > 0) {
                await this.resend.emails.send({
                    from: 'Ice Point System <pedidos@icepoint.com.br>',
                    to: adminEmails,
                    subject: `[ADMIN] Novo Pedido #${order.id} - ${this.formatCurrency(Number(order.valorTotal))}`,
                    html: this.generateOrderTemplate(order, false, processedImages),
                });
                this.logger.log(`Email enviado para ${adminEmails.length} admins`);
            }
        } catch (error) {
            this.logger.error('Erro ao enviar emails', error);
        }
    }

    async sendCancellationEmails(order: Encomendas, adminEmails: string[]) {
        try {
            if (order.emailCliente) {
                await this.resend.emails.send({
                    from: 'Ice Point <pedidos@icepoint.com.br>',
                    to: [order.emailCliente],
                    subject: `Atualização: Pedido #${order.id} Cancelado`,
                    html: this.generateCancellationTemplate(order, true),
                });
                this.logger.log(`Email de cancelamento enviado para cliente: ${order.emailCliente}`);
            }

            if (adminEmails.length > 0) {
                await this.resend.emails.send({
                    from: 'Ice Point System <pedidos@icepoint.com.br>',
                    to: adminEmails,
                    subject: `[CANCELADO] Pedido #${order.id} - ${this.formatCurrency(Number(order.valorTotal))}`,
                    html: this.generateCancellationTemplate(order, false),
                });
                this.logger.log(`Email de cancelamento enviado para ${adminEmails.length} admins`);
            }
        } catch (error) {
            this.logger.error('Erro ao enviar emails de cancelamento', error);
        }
    }
}
