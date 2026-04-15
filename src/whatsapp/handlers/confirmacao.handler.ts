import { Injectable } from '@nestjs/common';
import { EvolutionService } from '../evolution.service';
import { SessionService } from '../session.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class ConfirmacaoHandler {
  private supabase: SupabaseClient;

  constructor(
    private readonly evo: EvolutionService,
    private readonly session: SessionService,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );
  }

  async handle(ctx: any): Promise<void> {
    const { remoteJid, telefone, texto, session } = ctx;
    const dados = session.dados_temp;

    if (texto === '1' || texto === 'sim' || texto === 'confirmar') {
      await this.salvarEncomenda(remoteJid, telefone, dados);
    } else if (texto === '2' || texto === 'nao' || texto === 'não' || texto === 'cancelar') {
      await this.session.reset(telefone);
      await this.evo.sendText(remoteJid,
        '❌ Pedido cancelado.\n\nDigite *oi* para fazer um novo pedido.'
      );
    } else {
      await this.evo.sendText(remoteJid,
        'Por favor, confirme:\n*1* - ✅ Sim, confirmar pedido\n*2* - ❌ Cancelar'
      );
    }
  }

  private async salvarEncomenda(remoteJid: string, telefone: string, dados: any): Promise<void> {
    const valorProdutos = dados.itens.reduce(
      (acc: number, i: any) => acc + i.preco * i.quantidade, 0
    );

    const { data: encomenda, error } = await this.supabase
      .from('encomendas')
      .insert({
        nome_cliente: dados.nome,
        telefone_cliente: telefone,
        data_agendada: dados.data_agendada,
        hora_agendada: dados.hora_agendada,
        metodo_entrega: dados.metodo_entrega,
        endereco_cep: dados.cep,
        endereco_numero: dados.endereco_numero,
        valor_produtos: valorProdutos,
        valor_total: valorProdutos + (dados.taxa_entrega || 0),
        status: 'PENDENTE',
        status_pagamento: 'PENDENTE',
      })
      .select()
      .single();

    if (error || !encomenda) {
      await this.evo.sendText(remoteJid,
        '❌ Erro ao salvar o pedido. Por favor, tente novamente ou entre em contato direto.'
      );
      return;
    }

    // Salva os itens
    const itensInsert = dados.itens.map((i: any) => ({
      encomenda_id: encomenda.id,
      produto_id: i.produto_id,
      quantidade: i.quantidade,
      preco_unitario_congelado: i.preco,
    }));
    await this.supabase.from('encomenda_itens').insert(itensInsert);

    // Notifica o dono
    const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER;
    if (ownerPhone) {
      let notif = `🔔 *Novo Pedido #${encomenda.id}*\n\n`;
      notif += `👤 ${dados.nome}\n`;
      notif += `📅 ${dados.data_agendada} às ${dados.hora_agendada}\n`;
      notif += `🚗 ${dados.metodo_entrega}\n`;
      dados.itens.forEach((i: any) => notif += `• ${i.nome} x${i.quantidade}\n`);
      notif += `\n💰 Total: R$ ${valorProdutos.toFixed(2)}`;
      await this.evo.sendText(`${ownerPhone}@s.whatsapp.net`, notif);
    }

    await this.session.update(telefone, 'PEDIDO_FINALIZADO', {});
    await this.evo.sendText(remoteJid,
      `✅ *Pedido #${encomenda.id} confirmado!*\n\n` +
      `📅 ${dados.data_agendada} às ${dados.hora_agendada}\n` +
      `📦 ${dados.metodo_entrega}\n\n` +
      `Em breve entraremos em contato para combinar os detalhes.\n\n` +
      `Obrigado pela preferência! 🍦\n\nDigite *oi* para um novo pedido.`
    );
  }
}