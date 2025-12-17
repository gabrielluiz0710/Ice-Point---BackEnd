import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { Encomendas } from '../encomendas/encomendas.entity';
import { MetodoEntrega } from '../encomendas/encomenda.enums';

@Injectable()
export class CalendarService {
  private logger = new Logger(CalendarService.name);
  private calendar;
  private calendarId = process.env.GOOGLE_CALENDAR_ID;

  constructor() {
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!privateKey){
      this.logger.error('GOOGLE_PRIVATE_KEY não definida');
      throw new Error ('GOOGLE_PRIVATE_KEY missing');
    }

    if (privateKey.startsWith('"') && privateKey.endsWith('"')){
      privateKey = privateKey.slice(1, -1);
    }

    privateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_CLIENT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
  }

  async createOrderEvent(order: Encomendas, adminEmails: string[]) {
    try {
      const startDateTime = `${order.dataAgendada}T${order.horaAgendada}`;
      const startDateObj = new Date(startDateTime + 'Z');
      const endDateObj = new Date(startDateObj.getTime() + 1 * 60 * 60 * 1000);
      const endDateTimeString = endDateObj.toISOString().split('.')[0];
      const randomColorId = String(Math.floor(Math.random() * 11) + 1);

      const summary = `🍦 Pedido #${order.id} - ${order.nomeCliente}`;

      const productsByCategory: Record<string, string[]> = {};

      const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val));

      order.itens.forEach((item) => {
        const catName = item.produto.categoria?.nome || 'Outros';
        
        if (!productsByCategory[catName]) {
          productsByCategory[catName] = [];
        }

        productsByCategory[catName].push(`${item.produto.nome} - ${item.quantidade}x`);
      });

      let productsHtml = '';
      for (const [category, products] of Object.entries(productsByCategory)) {
        productsHtml += `\n<b>${category}:</b>\n${products.join('\n')}\n`;
      }

      const payIcon = order.metodoPagamento === 'PIX' ? '💠' : order.metodoPagamento === 'CASH' ? '💵' : '💳';
      let description = `
        <b>DADOS DO CLIENTE</b>
        👤 <b>Nome:</b> ${order.nomeCliente}
        📱 <b>Tel:</b> ${order.telefoneCliente}
        📊 <b>Status:</b> ${order.status}
        ${payIcon} <b>Pagamento:</b> ${order.metodoPagamento}

        ──────────────────────────
        
        🛒 <b>CARRINHOS SELECIONADOS</b>
        <ul>
          ${order.carrinhos?.length 
            ? order.carrinhos.map((c) => `<li>Carrinho <b>${c.cor}</b> (${c.identificacao})</li>`).join('') 
            : '<li>Nenhum carrinho específico</li>'}
        </ul>
        
        ──────────────────────────

        📦 <b>ITENS DO PEDIDO</b>
        ${productsHtml}

        ──────────────────────────

        💰 <b>RESUMO FINANCEIRO</b>
        • Produtos: ${fmt(order.valorProdutos)}
        • Frete: + ${fmt(order.taxaEntrega)}
        • Desconto: - ${fmt(order.valorDesconto)}
        
        <b>TOTAL: ${fmt(order.valorTotal)}</b>
      `;

      let location = 'Retirada na Loja Ice Point';

      if (order.metodoEntrega === MetodoEntrega.DELIVERY) {
        location = `${order.enderecoLogradouro}, ${order.enderecoNumero} - ${order.enderecoBairro}, ${order.enderecoCidade}`;
        description += `
        ──────────────────────────
        
        📍 <b>ENTREGA</b>
        ${order.enderecoLogradouro}, ${order.enderecoNumero}
        ${order.enderecoComplemento ? `(${order.enderecoComplemento})<br>` : ''}
        ${order.enderecoBairro} - ${order.enderecoCidade}/${order.enderecoEstado}
        CEP: ${order.enderecoCep}
        
        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}">🗺️ Abrir no Maps</a>
        `;
      }

      const event = {
        summary: summary,
        location: location,
        description: description,
        start: {
          dateTime: startDateTime,
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: endDateTimeString,
          timeZone: 'America/Sao_Paulo',
        },
        reminders: {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: 60 }],
        },
        colorId: randomColorId,
      };

      const response = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
      });

      this.logger.log(`Evento criado na agenda da loja! Link: ${response.data.htmlLink}`);
      return response.data.id;

    } catch (error) {
      this.logger.error(
        'Erro ao criar evento no Google Calendar', 
        error?.response?.data || error.message || error
      );
    }
  }

  async deleteOrderEvent(googleEventId: string) {
    if (!googleEventId) return;

    try {
      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: googleEventId,
      });
      this.logger.log(`Evento ${googleEventId} removido do Google Calendar.`);
    } catch (error) {
      this.logger.warn(`Falha ao remover evento do calendário: ${error.message}`);
    }
  }
}