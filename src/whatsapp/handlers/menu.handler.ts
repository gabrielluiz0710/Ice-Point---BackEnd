import { Injectable } from '@nestjs/common';
import { EvolutionService } from '../evolution.service';
import { SessionService } from '../session.service';

@Injectable()
export class MenuHandler {
  constructor(
    private readonly evo: EvolutionService,
    private readonly session: SessionService,
  ) {}

  async handle(ctx: any): Promise<void> {
    const { remoteJid, telefone, nomeContato, texto } = ctx;

    const saudacoes = ['oi', 'olá', 'ola', 'ola!', 'oi!', 'bom dia', 'boa tarde', 'boa noite', 'inicio', 'comecar', 'começar', '0'];

    if (saudacoes.some(s => texto.includes(s)) || ctx.session.estado === 'INICIO') {
      await this.session.update(telefone, 'MENU_PRINCIPAL');
      await this.evo.sendText(remoteJid,
        `Olá, ${nomeContato}! 👋🍦\n\nBem-vindo à *Ice Point*!\n\nEscolha uma opção:\n\n*1* - 🛒 Ver carrinhos de picolé\n*2* - 📋 Fazer encomenda\n*3* - 📞 Falar com atendente\n\n_Digite o número da opção desejada_`
      );
      return;
    }

    switch (texto) {
      case '1':
        await this.session.update(telefone, 'VER_PRODUTOS');
        // Handler de encomenda também trata VER_PRODUTOS
        break;
      case '2':
        await this.session.update(telefone, 'INICIANDO_ENCOMENDA');
        break;
      case '3':
        await this.evo.sendText(remoteJid,
          '📞 Tudo bem! Um atendente vai te responder em breve.\n\nSe quiser voltar ao menu automático, digite *menu*.'
        );
        return;
      default:
        await this.evo.sendText(remoteJid,
          'Não entendi 😅 Digite *1*, *2* ou *3* para escolher uma opção, ou *oi* para ver o menu novamente.'
        );
        return;
    }

    // Após atualizar estado, processa imediatamente no handler correto
    // (o whatsapp.service vai reprocessar na próxima mensagem,
    // mas aqui disparamos já o próximo passo)
    if (texto === '1') await this.mostrarProdutos(remoteJid, telefone);
    if (texto === '2') await this.iniciarEncomenda(remoteJid, telefone, nomeContato);
  }

  private async mostrarProdutos(remoteJid: string, telefone: string): Promise<void> {
    // Busca produtos do Supabase aqui ou injeta ProdutosService
    await this.evo.sendText(remoteJid,
      '🛒 *Nossos Carrinhos de Picolé*\n\nCarregando cardápio...'
    );
  }

  private async iniciarEncomenda(remoteJid: string, telefone: string, nome: string): Promise<void> {
    await this.session.update(telefone, 'AGUARDANDO_NOME', {});
    await this.evo.sendText(remoteJid,
      '📋 *Nova Encomenda*\n\nVamos começar! Primeiro, qual é o seu nome completo?'
    );
  }
}