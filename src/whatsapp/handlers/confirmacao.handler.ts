import { Injectable, Logger } from '@nestjs/common';
import { EvolutionService } from '../evolution.service';
import { SessionService } from '../session.service';
import { MailService } from '../../mail/mail.service';
import { CalendarService } from '../../calendar/calendar.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class ConfirmacaoHandler {
  private readonly logger = new Logger(ConfirmacaoHandler.name);
  private supabase: SupabaseClient;

  constructor(
    private readonly evo: EvolutionService,
    private readonly session: SessionService,
    private readonly mailService: MailService,
    private readonly calendarService: CalendarService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );
  }

  async handle(ctx: any): Promise<void> {
    const { remoteJid, telefone, texto, session } = ctx;
    const dados = session.dados_temp;

    switch (texto) {
      case '1':
      case 'sim':
      case 'confirmar':
        await this.salvarEncomenda(remoteJid, telefone, dados);
        break;

      case '2':
      case 'nao':
      case 'não':
      case 'cancelar':
        await this.session.reset(telefone);
        await this.evo.sendText(
          remoteJid,
          '❌ Pedido cancelado.\n\nDigite *oi* para ver o menu principal.',
        );
        break;

      case '3':
      case 'editar':
        // Voltar para confirmação de itens para editar
        await this.session.update(telefone, 'CONFIRMANDO_ITENS', dados);
        await this.evo.sendText(
          remoteJid,
          '✏️ O que gostaria de fazer?\n\n' +
            '*1* - ✅ Manter os itens e continuar\n' +
            '*2* - ✏️ Refazer a lista de picolés\n' +
            '*3* - ➕ Adicionar mais picolés',
        );
        break;

      default:
        await this.evo.sendText(
          remoteJid,
          'Por favor, escolha:\n\n' +
            '*1* - ✅ Confirmar pedido\n' +
            '*2* - ❌ Cancelar\n' +
            '*3* - ✏️ Editar pedido',
        );
    }
  }

  private async salvarEncomenda(
    remoteJid: string,
    telefone: string,
    dados: any,
  ): Promise<void> {
    await this.evo.sendText(remoteJid, '🔄 Processando seu pedido...');

    try {
      // Map pagamento para os enums do banco
      const pagamentoMap: Record<string, string> = {
        DINHEIRO: 'CASH',
        PIX: 'PIX',
        CARTAO: 'CARD',
      };

      const metodoEntregaDB =
        dados.metodo_entrega === 'RETIRADA' ? 'PICKUP' : 'DELIVERY';

      // 1. Salvar encomenda
      const { data: encomenda, error } = await this.supabase
        .from('encomendas')
        .insert({
          nome_cliente: dados.nome,
          email_cliente: dados.email,
          telefone_cliente: telefone,
          data_agendada: dados.data_agendada,
          hora_agendada: dados.hora_agendada,
          metodo_entrega: metodoEntregaDB,
          endereco_logradouro: dados.endereco_logradouro || null,
          endereco_numero: dados.endereco_numero || null,
          endereco_complemento: dados.endereco_complemento || null,
          endereco_bairro: dados.endereco_bairro || null,
          endereco_cidade: dados.endereco_cidade || null,
          endereco_estado: dados.endereco_estado || null,
          endereco_cep: dados.endereco_cep || null,
          taxa_entrega: dados.taxa_entrega || 0,
          valor_produtos: dados.valor_produtos || 0,
          valor_desconto: dados.valor_desconto || 0,
          valor_total: dados.valor_total || 0,
          metodo_pagamento: pagamentoMap[dados.metodo_pagamento] || 'CASH',
          status: 'CONFIRMADO',
          status_pagamento: 'PENDENTE',
        })
        .select()
        .single();

      if (error || !encomenda) {
        this.logger.error('Erro ao salvar encomenda:', error);
        await this.evo.sendText(
          remoteJid,
          '❌ Erro ao salvar o pedido. Por favor, tente novamente ou fale com um atendente.',
        );
        return;
      }

      // 2. Salvar itens
      const itensInsert = (dados.itens || []).map((i: any) => ({
        encomenda_id: encomenda.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        preco_unitario_congelado: i.preco,
      }));
      await this.supabase.from('encomenda_itens').insert(itensInsert);

      // 3. Salvar associação com carrinho
      if (dados.carrinho_id) {
        await this.supabase.from('encomendas_carrinhos').insert({
          encomenda_id: encomenda.id,
          carrinho_id: dados.carrinho_id,
        });
      }

      // 4. Enviar email e criar evento no calendário
      try {
        const { data: fullOrder } = await this.supabase
          .from('encomendas')
          .select(
            `*, itens:encomenda_itens(*, produto:produtos(*)), carrinhos_rel:encomendas_carrinhos(carrinho:carrinhos(*))`,
          )
          .eq('id', encomenda.id)
          .single();

        if (fullOrder) {
          const orderForServices = this.transformOrderForServices(fullOrder);

          // Buscar emails dos admins
          const { data: admins } = await this.supabase
            .from('usuarios')
            .select('email')
            .eq('tipo', 'ADMIN');
          const adminEmails = (admins || [])
            .map((a: any) => a.email)
            .filter(Boolean);

          // Enviar emails
          await this.mailService.sendNewOrderEmails(
            orderForServices,
            adminEmails,
          );

          // Criar evento no Google Calendar
          const googleEventId = await this.calendarService.createOrderEvent(
            orderForServices,
            adminEmails,
          );
          if (googleEventId) {
            await this.supabase
              .from('encomendas')
              .update({ google_event_id: googleEventId })
              .eq('id', encomenda.id);
          }
        }
      } catch (emailError) {
        this.logger.error('Erro ao enviar email/calendar:', emailError);
        // Não falhar o pedido por causa do email
      }

      // 5. Notificar o dono via WhatsApp
      const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER;
      if (ownerPhone) {
        const metodoLabel =
          dados.metodo_pagamento === 'DINHEIRO'
            ? '💵 Dinheiro'
            : dados.metodo_pagamento === 'PIX'
              ? '💠 Pix'
              : '💳 Cartão';

        let notif = `🔔 *Novo Pedido #${encomenda.id}*\n\n`;
        notif += `👤 ${dados.nome}\n`;
        notif += `📧 ${dados.email}\n`;
        notif += `📱 ${telefone}\n`;
        notif += `📅 ${this.formatDateBR(dados.data_agendada)} às ${dados.hora_agendada}\n`;
        notif += `🛒 Carrinho: ${dados.carrinho_cor}\n`;
        notif += `🚗 ${dados.metodo_entrega === 'RETIRADA' ? 'Retirada' : 'Entrega'}\n`;
        if (dados.metodo_entrega === 'ENTREGA' && dados.endereco_logradouro) {
          notif += `📍 ${dados.endereco_logradouro}, ${dados.endereco_numero}`;
          if (dados.endereco_bairro) notif += ` - ${dados.endereco_bairro}`;
          notif += '\n';
        }
        notif += `${metodoLabel}\n\n`;
        notif += '🍦 *Picolés:*\n';
        (dados.itens || []).forEach((i: any) => {
          notif += `• ${i.nome} × ${i.quantidade}\n`;
        });
        notif += `\n💰 Total: R$ ${(dados.valor_total || 0).toFixed(2)}`;

        try {
          await this.evo.sendText(`${ownerPhone}@s.whatsapp.net`, notif);
        } catch {
          this.logger.warn('Falha ao notificar dono via WhatsApp');
        }
      }

      // 6. Mensagem de sucesso ao cliente
      await this.session.update(telefone, 'PEDIDO_FINALIZADO', {});
      await this.evo.sendText(
        remoteJid,
        `🎉 *Pedido #${encomenda.id} confirmado com sucesso!*\n\n` +
          `📅 ${this.formatDateBR(dados.data_agendada)} às ${dados.hora_agendada}\n` +
          `🛒 Carrinho ${dados.carrinho_cor}\n` +
          `🚗 ${dados.metodo_entrega === 'RETIRADA' ? 'Retirada na sorveteria' : 'Entrega no endereço'}\n` +
          `💰 Total: R$ ${(dados.valor_total || 0).toFixed(2)}\n\n` +
          `📧 Um email de confirmação foi enviado para *${dados.email}*\n\n` +
          `💻 Você pode acompanhar seu pedido em nosso site:\n` +
          `https://www.icepoint.com.br/perfil\n` +
          `_Faça login ou cadastre-se com o email informado._\n\n` +
          `Obrigado pela preferência! 🍦\n\nDigite *oi* para ver o menu principal.`,
      );
    } catch (err) {
      this.logger.error('Erro geral ao salvar encomenda:', err);
      await this.evo.sendText(
        remoteJid,
        '❌ Ocorreu um erro ao processar seu pedido. Por favor, tente novamente ou fale com um atendente.',
      );
    }
  }

  /**
   * Transforma o resultado do Supabase para o formato esperado pelo MailService e CalendarService
   * (que esperam o formato da entidade TypeORM com nomes camelCase)
   */
  private transformOrderForServices(fullOrder: any): any {
    const carrinhos = (fullOrder.carrinhos_rel || [])
      .map((ec: any) => ec.carrinho)
      .filter(Boolean);

    const itens = (fullOrder.itens || []).map((item: any) => ({
      ...item,
      produto: item.produto,
      precoUnitarioCongelado: item.preco_unitario_congelado,
    }));

    return {
      id: fullOrder.id,
      nomeCliente: fullOrder.nome_cliente,
      emailCliente: fullOrder.email_cliente,
      telefoneCliente: fullOrder.telefone_cliente,
      dataAgendada: fullOrder.data_agendada,
      horaAgendada: fullOrder.hora_agendada,
      metodoEntrega: fullOrder.metodo_entrega,
      taxaEntrega: fullOrder.taxa_entrega,
      enderecoLogradouro: fullOrder.endereco_logradouro,
      enderecoNumero: fullOrder.endereco_numero,
      enderecoComplemento: fullOrder.endereco_complemento,
      enderecoBairro: fullOrder.endereco_bairro,
      enderecoCidade: fullOrder.endereco_cidade,
      enderecoEstado: fullOrder.endereco_estado,
      enderecoCep: fullOrder.endereco_cep,
      valorProdutos: fullOrder.valor_produtos,
      valorDesconto: fullOrder.valor_desconto,
      valorTotal: fullOrder.valor_total,
      metodoPagamento: fullOrder.metodo_pagamento,
      status: fullOrder.status,
      statusPagamento: fullOrder.status_pagamento,
      googleEventId: fullOrder.google_event_id,
      carrinhos,
      itens,
    };
  }

  private formatDateBR(dateStr: string): string {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  }
}
