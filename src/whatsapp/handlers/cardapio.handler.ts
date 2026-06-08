import { Injectable } from '@nestjs/common';
import { EvolutionService } from '../evolution.service';
import { SessionService } from '../session.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class CardapioHandler {
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

  /** Chamado pelo MenuHandler quando o cliente seleciona "1 - Ver cardápio" */
  async enviarCardapio(ctx: any): Promise<void> {
    const { remoteJid, telefone } = ctx;

    // 1. Buscar produtos agrupados por categoria
    const { data: produtos } = await this.supabase
      .from('produtos')
      .select(
        'id, nome, preco_unitario, imagem_capa, categoria:categorias(nome)',
      )
      .eq('disponivel', true)
      .order('nome');

    // 2. Enviar imagens de capa dos produtos (até 5 para não lotar)
    const produtosComImagem = (produtos || []).filter(
      (p: any) => p.imagem_capa,
    );
    const imagensParaEnviar = produtosComImagem.slice(0, 5);

    for (const produto of imagensParaEnviar) {
      await this.evo.sendImage(
        remoteJid,
        produto.imagem_capa,
        `🍦 ${produto.nome} — R$ ${Number(produto.preco_unitario).toFixed(2)}`,
      );
      await this.delay(1000);
    }

    // 3. Montar lista de produtos por categoria (ordem alfabética, sem números)
    const porCategoria: Record<string, any[]> = {};
    for (const p of produtos || []) {
      const cat = (p as any).categoria?.nome || 'Outros';
      if (!porCategoria[cat]) porCategoria[cat] = [];
      porCategoria[cat].push(p);
    }

    let catalogo = '📋 *Nosso Cardápio Completo*\n\n';
    const categoriasOrdenadas = Object.keys(porCategoria).sort();
    for (const cat of categoriasOrdenadas) {
      catalogo += `🍦 *${cat}*\n`;
      const produtosCat = porCategoria[cat].sort((a: any, b: any) =>
        a.nome.localeCompare(b.nome),
      );
      for (const p of produtosCat) {
        catalogo += `• ${p.nome} — R$ ${Number(p.preco_unitario).toFixed(2)}\n`;
      }
      catalogo += '\n';
    }

    await this.evo.sendText(remoteJid, catalogo);
    await this.delay(500);

    // 4. Informações + opções
    await this.evo.sendText(
      remoteJid,
      '📍 *Ice Point Sorveteria*\n' +
        'Av. Padre Eddie Bernardes da Silva, 965 - Lourdes, Uberaba - MG\n' +
        '🕐 Seg a Dom: 11:00 - 20:00\n\n' +
        'O que gostaria de fazer?\n\n' +
        '*1* - ↩️ Voltar ao menu principal\n' +
        '*2* - 👤 Falar com atendente\n\n' +
        '_📌 Digite *menu* a qualquer momento para voltar ao início_',
    );

    await this.session.update(telefone, 'CARDAPIO_ENVIADO');
  }

  /** Chamado pelo WhatsappService quando o estado é CARDAPIO_ENVIADO */
  async handle(ctx: any): Promise<void> {
    const { remoteJid, telefone, texto } = ctx;

    switch (texto) {
      case '1':
      case 'voltar':
        await this.session.reset(telefone);
        await this.evo.sendText(
          remoteJid,
          '↩️ Voltando ao menu principal!\n\nDigite *oi* para ver as opções.',
        );
        break;

      case '2':
        await this.session.setHumanMode(telefone, true);
        await this.evo.sendText(
          remoteJid,
          '👤 Certo! Um atendente vai te responder em breve.\n\n' +
            '_Quando o atendimento for encerrado, o menu automático voltará a funcionar._',
        );
        break;

      default:
        await this.evo.sendText(
          remoteJid,
          'Digite *1* para voltar ao menu ou *2* para falar com um atendente.',
        );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
