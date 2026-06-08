import { Injectable } from '@nestjs/common';
import { EvolutionService } from '../evolution.service';
import { SessionService } from '../session.service';

@Injectable()
export class InfoHandler {
  constructor(
    private readonly evo: EvolutionService,
    private readonly session: SessionService,
  ) {}

  /** Chamado pelo MenuHandler quando o cliente seleciona "3 - Informações" */
  async enviarInfo(ctx: any): Promise<void> {
    const { remoteJid, telefone } = ctx;

    const mensagem =
      `Acha que a gente desapareceu?\n` +
      `Que nada! Nossos sorvetes te esperam em um lugar mágico! 🍦✨\n\n` +
      `*Chega Mais para um Abraço Gelado!*\n` +
      `Onde a felicidade encontra o sorvete! Fácil de achar, impossível de resistir. ` +
      `Venha nos visitar e torne seu dia muito mais doce!\n\n` +
      `📍 *Nosso Endereço:*\n` +
      `Av. Padre Eddie Bernardes da Silva, 965 - Lourdes, Uberaba - MG\n\n` +
      `🗺️ *Pegue um atalho:*\n` +
      `Google Maps: https://maps.app.goo.gl/IcePointUberaba\n` +
      `Waze: https://waze.com/ul?q=Ice+Point+Uberaba\n\n` +
      `🕐 *Horário de Funcionamento:*\n` +
      `Segunda a Domingo: 11:00 - 20:00\n\n` +
      `📱 *Redes Sociais:*\n` +
      `Facebook: /IcePointUberaba\n` +
      `Instagram: /icepointuberaba\n\n` +
      `───────────────────\n\n` +
      `O que gostaria de fazer?\n\n` +
      `*1* - ↩️ Voltar ao menu principal\n` +
      `*2* - 👤 Falar com atendente\n\n` +
      `_📌 Digite *menu* a qualquer momento para voltar ao início_`;

    await this.evo.sendText(remoteJid, mensagem);
    await this.session.update(telefone, 'INFO_ENVIADA');
  }

  /** Chamado pelo WhatsappService quando o estado é INFO_ENVIADA */
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
}
