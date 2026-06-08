import { Injectable } from '@nestjs/common';
import { EvolutionService } from '../evolution.service';
import { SessionService } from '../session.service';
import { CardapioHandler } from './cardapio.handler';
import { InfoHandler } from './info.handler';
import { EncomendaHandler } from './encomenda.handler';

@Injectable()
export class MenuHandler {
  constructor(
    private readonly evo: EvolutionService,
    private readonly session: SessionService,
    private readonly cardapioHandler: CardapioHandler,
    private readonly infoHandler: InfoHandler,
    private readonly encomendaHandler: EncomendaHandler,
  ) {}

  async handle(ctx: any): Promise<void> {
    const { remoteJid, telefone, nomeContato, texto } = ctx;

    const saudacoes = [
      'oi',
      'olá',
      'ola',
      'oi!',
      'bom dia',
      'boa tarde',
      'boa noite',
      'inicio',
      'comecar',
      'começar',
      'hey',
      'hello',
    ];

    if (
      saudacoes.some((s) => texto.includes(s)) ||
      ctx.session.estado === 'INICIO'
    ) {
      await this.enviarMenu(remoteJid, telefone, nomeContato);
      return;
    }

    switch (texto) {
      case '1':
        await this.cardapioHandler.enviarCardapio(ctx);
        break;

      case '2':
        await this.encomendaHandler.iniciarEncomenda(ctx);
        break;

      case '3':
        await this.infoHandler.enviarInfo(ctx);
        break;

      case '4':
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
          'Não entendi 😅\n\nDigite *1*, *2*, *3* ou *4* para escolher uma opção, ou *oi* para ver o menu novamente.',
        );
    }
  }

  async enviarMenu(
    remoteJid: string,
    telefone: string,
    nomeContato: string,
  ): Promise<void> {
    await this.session.update(telefone, 'MENU_PRINCIPAL');
    await this.evo.sendText(
      remoteJid,
      `Olá, ${nomeContato}! 👋🍦\n\n` +
        `Bem-vindo à *Ice Point*!\n\n` +
        `Escolha uma opção:\n\n` +
        `*1* - 📋 Ver cardápio\n` +
        `*2* - 🛒 Fazer encomenda de carrinho de picolé para festa\n` +
        `*3* - ℹ️ Informações sobre a sorveteria\n` +
        `*4* - 👤 Falar com atendente\n\n` +
        `_Digite o número da opção desejada_`,
    );
  }
}
