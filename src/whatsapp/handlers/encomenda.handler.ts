import { Injectable } from '@nestjs/common';
import { EvolutionService } from '../evolution.service';
import { SessionService } from '../session.service';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

@Injectable()
export class EncomendaHandler {
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
    const estado = session.estado;
    const dados = session.dados_temp;

    switch (estado) {

      case 'VER_PRODUTOS': {
        const produtos = await this.getProdutos();
        let msg = '🍦 *Nossos Carrinhos de Picolé*\n\n';
        produtos.forEach((p, i) => {
          msg += `*${i + 1}* - ${p.nome}\n`;
          msg += `   💰 R$ ${Number(p.preco_unitario).toFixed(2)}\n`;
          if (p.descricao) msg += `   ${p.descricao}\n`;
          msg += '\n';
        });
        msg += '---\nDigite *2* para fazer uma encomenda ou *0* para voltar ao menu.';
        await this.evo.sendText(remoteJid, msg);
        await this.session.update(telefone, 'MENU_PRINCIPAL');
        break;
      }

      case 'AGUARDANDO_NOME': {
        if (texto.length < 3) {
          await this.evo.sendText(remoteJid, 'Por favor, informe um nome válido.');
          return;
        }
        const nomeFmt = texto.replace(/\b\w/g, (l: string) => l.toUpperCase());
        await this.session.update(telefone, 'AGUARDANDO_DATA', { ...dados, nome: nomeFmt });
        await this.evo.sendText(remoteJid,
          `Ótimo, *${nomeFmt}*! 👍\n\nQual será a *data da festa*?\n\nFormato: DD/MM/AAAA\nExemplo: 25/12/2025`
        );
        break;
      }

      case 'AGUARDANDO_DATA': {
        const dataRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        if (!dataRegex.test(texto)) {
          await this.evo.sendText(remoteJid, '❌ Data inválida. Use o formato DD/MM/AAAA\nExemplo: *25/12/2025*');
          return;
        }
        const [, dia, mes, ano] = texto.match(dataRegex)!;
        const dataObj = new Date(`${ano}-${mes}-${dia}`);
        if (dataObj < new Date()) {
          await this.evo.sendText(remoteJid, '❌ Essa data já passou. Por favor, informe uma data futura.');
          return;
        }
        await this.session.update(telefone, 'AGUARDANDO_HORA', { ...dados, data_agendada: `${ano}-${mes}-${dia}` });
        await this.evo.sendText(remoteJid,
          `📅 Data registrada: *${texto}*\n\nQual será o *horário*?\n\nFormato: HH:MM\nExemplo: 16:00`
        );
        break;
      }

      case 'AGUARDANDO_HORA': {
        const horaRegex = /^(\d{2}):(\d{2})$/;
        if (!horaRegex.test(texto)) {
          await this.evo.sendText(remoteJid, '❌ Horário inválido. Use o formato HH:MM\nExemplo: *16:00*');
          return;
        }
        await this.session.update(telefone, 'AGUARDANDO_ENTREGA', { ...dados, hora_agendada: texto });
        await this.evo.sendText(remoteJid,
          `⏰ Horário registrado: *${texto}*\n\nComo prefere receber o carrinho?\n\n*1* - 🏃 Retirada no local\n*2* - 🚗 Entrega no endereço`
        );
        break;
      }

      case 'AGUARDANDO_ENTREGA': {
        if (!['1', '2'].includes(texto)) {
          await this.evo.sendText(remoteJid, 'Digite *1* para retirada ou *2* para entrega.');
          return;
        }
        const metodo = texto === '1' ? 'RETIRADA' : 'ENTREGA';
        if (metodo === 'RETIRADA') {
          await this.session.update(telefone, 'AGUARDANDO_PRODUTOS', { ...dados, metodo_entrega: metodo });
          await this.mostrarMenuProdutos(remoteJid);
        } else {
          await this.session.update(telefone, 'AGUARDANDO_CEP', { ...dados, metodo_entrega: metodo });
          await this.evo.sendText(remoteJid, '📍 Qual é o *CEP* do endereço de entrega?');
        }
        break;
      }

      case 'AGUARDANDO_CEP': {
        const cep = texto.replace(/\D/g, '');
        if (cep.length !== 8) {
          await this.evo.sendText(remoteJid, '❌ CEP inválido. Informe os 8 dígitos.\nExemplo: *38005000*');
          return;
        }
        await this.session.update(telefone, 'AGUARDANDO_NUMERO_ENDERECO', { ...dados, cep });
        await this.evo.sendText(remoteJid, '🏠 Qual é o *número* do endereço?');
        break;
      }

      case 'AGUARDANDO_NUMERO_ENDERECO': {
        await this.session.update(telefone, 'AGUARDANDO_PRODUTOS', { ...dados, endereco_numero: texto });
        await this.mostrarMenuProdutos(remoteJid);
        break;
      }

      case 'AGUARDANDO_PRODUTOS': {
        const produtos = await this.getProdutos();
        const idx = parseInt(texto) - 1;
        if (isNaN(idx) || idx < 0 || idx >= produtos.length) {
          await this.evo.sendText(remoteJid, `❌ Opção inválida. Digite um número entre 1 e ${produtos.length}.`);
          return;
        }
        const produto = produtos[idx];
        await this.session.update(telefone, 'AGUARDANDO_QUANTIDADE', {
          ...dados,
          produto_selecionado_id: produto.id,
          produto_selecionado_nome: produto.nome,
          produto_selecionado_preco: produto.preco_unitario,
        });
        await this.evo.sendText(remoteJid,
          `Você escolheu: *${produto.nome}* - R$ ${Number(produto.preco_unitario).toFixed(2)}\n\nQuantas unidades deseja?`
        );
        break;
      }

      case 'AGUARDANDO_QUANTIDADE': {
        const qtd = parseInt(texto);
        if (isNaN(qtd) || qtd < 1 || qtd > 999) {
          await this.evo.sendText(remoteJid, '❌ Quantidade inválida. Digite um número entre 1 e 999.');
          return;
        }
        const itens = dados.itens || [];
        const jaExiste = itens.findIndex((i: any) => i.produto_id === dados.produto_selecionado_id);
        if (jaExiste >= 0) {
          itens[jaExiste].quantidade += qtd;
        } else {
          itens.push({
            produto_id: dados.produto_selecionado_id,
            nome: dados.produto_selecionado_nome,
            quantidade: qtd,
            preco: Number(dados.produto_selecionado_preco),
          });
        }
        await this.session.update(telefone, 'AGUARDANDO_PRODUTOS', {
          ...dados,
          itens,
          produto_selecionado_id: undefined,
          produto_selecionado_nome: undefined,
          produto_selecionado_preco: undefined,
        });

        let msg = `✅ Adicionado: *${dados.produto_selecionado_nome}* x${qtd}\n\n`;
        msg += '📦 *Itens no pedido:*\n';
        itens.forEach((i: any) => {
          msg += `• ${i.nome} x${i.quantidade} = R$ ${(i.preco * i.quantidade).toFixed(2)}\n`;
        });
        msg += '\n*1* - ➕ Adicionar mais um produto\n*2* - ✅ Finalizar e confirmar pedido';
        await this.evo.sendText(remoteJid, msg);
        break;
      }
    }
  }

  private async mostrarMenuProdutos(remoteJid: string): Promise<void> {
    const produtos = await this.getProdutos();
    let msg = '🍦 *Escolha um produto:*\n\n';
    produtos.forEach((p, i) => {
      msg += `*${i + 1}* - ${p.nome} — R$ ${Number(p.preco_unitario).toFixed(2)}\n`;
    });
    await this.evo.sendText(remoteJid, msg);
  }

  private async getProdutos(): Promise<any[]> {
    const { data } = await this.supabase
      .from('produtos')
      .select('id, nome, descricao, preco_unitario')
      .eq('disponivel', true)
      .order('nome');
    return data || [];
  }
}