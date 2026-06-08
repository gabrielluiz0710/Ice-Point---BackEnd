import { Injectable, Logger } from '@nestjs/common';
import { SessionService } from './session.service';
import { EvolutionService } from './evolution.service';
import { MenuHandler } from './handlers/menu.handler';
import { CardapioHandler } from './handlers/cardapio.handler';
import { InfoHandler } from './handlers/info.handler';
import { EncomendaHandler } from './handlers/encomenda.handler';
import { ConfirmacaoHandler } from './handlers/confirmacao.handler';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly evolutionService: EvolutionService,
    private readonly menuHandler: MenuHandler,
    private readonly cardapioHandler: CardapioHandler,
    private readonly infoHandler: InfoHandler,
    private readonly encomendaHandler: EncomendaHandler,
    private readonly confirmacaoHandler: ConfirmacaoHandler,
  ) {}

  private resolverRemoteJid(key: any): string | null {
    const remoteJid: string = key?.remoteJid;

    if (!remoteJid) return null;

    // Caso ideal: já é número normal
    if (remoteJid.includes('@s.whatsapp.net')) return remoteJid;

    // Caso @lid com alternativa disponível (versões recentes da Evolution)
    if (remoteJid.includes('@lid')) {
      if (key?.remoteJidAlt?.includes('@s.whatsapp.net')) {
        this.logger.log(
          `@lid resolvido via remoteJidAlt: ${remoteJid} → ${key.remoteJidAlt}`,
        );
        return key.remoteJidAlt;
      }

      // Sem remoteJidAlt: tenta mandar o @lid direto (funciona em Evolution recente)
      this.logger.warn(
        `@lid sem remoteJidAlt, tentando enviar JID @lid direto: ${remoteJid}`,
      );
      return remoteJid;
    }

    return remoteJid;
  }

  /** Detecta mensagens de mídia (áudio, imagem, vídeo, sticker, documento) */
  private isMediaMessage(message: any): boolean {
    return !!(
      message?.audioMessage ||
      message?.imageMessage ||
      message?.videoMessage ||
      message?.stickerMessage ||
      message?.documentMessage
    );
  }

  async processMessage(payload: any): Promise<void> {
    if (payload?.data?.key?.fromMe) return;
    if (payload?.event !== 'messages.upsert') return;

    const key = payload?.data?.key;
    const remoteJid = this.resolverRemoteJid(key);

    if (!remoteJid) {
      this.logger.error(
        'Não foi possível determinar remoteJid válido. Payload ignorado.',
      );
      return;
    }

    const message = payload?.data?.message;
    const telefone = remoteJid
      .replace('@s.whatsapp.net', '')
      .replace('@lid', '');
    const nomeContato: string = payload?.data?.pushName || 'Cliente';

    // ─── Verificar atendimento humano antes de tudo ───
    const session = await this.sessionService.getOrCreate(telefone);

    if (session.atendimento_humano) {
      this.logger.log(
        `[${telefone}] Em atendimento humano — ignorando mensagem.`,
      );
      return;
    }

    // ─── Detectar mídia (áudio, imagem, etc.) ───
    if (this.isMediaMessage(message)) {
      await this.evolutionService.sendText(
        remoteJid,
        '⚠️ Desculpe, por enquanto não consigo processar áudios, imagens ou outros arquivos.\n\n' +
          'Poderia *digitar* sua mensagem? ✍️\n\n' +
          'Ou se preferir, posso te transferir para um *atendente humano*.\n' +
          'Digite *atendente* para falar com uma pessoa.',
      );
      return;
    }

    // ─── Extrair texto ───
    const texto: string = (
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      ''
    )
      .trim()
      .toLowerCase();

    if (!texto) return;

    this.logger.log(
      `[${telefone}] Estado: ${session.estado} | Msg: "${texto}"`,
    );

    // ─── Comando global: "atendente" de qualquer estado ───
    if (texto === 'atendente') {
      await this.sessionService.setHumanMode(telefone, true);
      await this.evolutionService.sendText(
        remoteJid,
        '👤 Certo! Um atendente vai te responder em breve.\n\n' +
          '_Quando o atendimento for encerrado, o menu automático voltará a funcionar._',
      );
      return;
    }

    // ─── Comando global: voltar ao menu principal ───
    if (
      texto === 'menu' ||
      texto === '0' ||
      texto === 'voltar' ||
      texto === 'cancelar' ||
      texto === 'sair'
    ) {
      await this.sessionService.reset(telefone);
      await this.menuHandler.enviarMenu(remoteJid, telefone, nomeContato);
      return;
    }

    // ─── Roteamento por estado ───
    const context = { telefone, remoteJid, texto, nomeContato, session };

    switch (session.estado) {
      case 'INICIO':
      case 'MENU_PRINCIPAL':
        await this.menuHandler.handle(context);
        break;

      case 'CARDAPIO_ENVIADO':
        await this.cardapioHandler.handle(context);
        break;

      case 'INFO_ENVIADA':
        await this.infoHandler.handle(context);
        break;

      case 'AGUARDANDO_LISTA_PICOLES':
      case 'CONFIRMANDO_ITENS':
      case 'AGUARDANDO_NOME':
      case 'AGUARDANDO_EMAIL':
      case 'AGUARDANDO_DATA_HORA':
      case 'AGUARDANDO_CARRINHO_COR':
      case 'AGUARDANDO_ENTREGA':
      case 'AGUARDANDO_ENDERECO':
      case 'AGUARDANDO_PAGAMENTO':
        await this.encomendaHandler.handle(context);
        break;

      case 'CONFIRMANDO_PEDIDO':
        await this.confirmacaoHandler.handle(context);
        break;

      case 'PEDIDO_FINALIZADO':
      case 'ATENDIMENTO_HUMANO':
        // Resetar e mostrar menu
        await this.sessionService.reset(telefone);
        await this.menuHandler.handle({
          ...context,
          session: { ...session, estado: 'INICIO' },
        });
        break;

      default:
        // Estado desconhecido — resetar
        await this.sessionService.reset(telefone);
        await this.menuHandler.handle({
          ...context,
          session: { ...session, estado: 'INICIO' },
        });
    }
  }
}
