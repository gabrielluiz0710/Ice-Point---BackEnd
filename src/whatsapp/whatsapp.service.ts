import { Injectable, Logger } from '@nestjs/common';
import { SessionService } from './session.service';
import { EvolutionService } from './evolution.service';
import { MenuHandler } from './handlers/menu.handler';
import { EncomendaHandler } from './handlers/encomenda.handler';
import { ConfirmacaoHandler } from './handlers/confirmacao.handler';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly evolutionService: EvolutionService,
    private readonly menuHandler: MenuHandler,
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

  async processMessage(payload: any): Promise<void> {
    if (payload?.data?.key?.fromMe) return;
    if (payload?.event !== 'messages.upsert') return;

    this.logger.log('PAYLOAD COMPLETO: ' + JSON.stringify(payload, null, 2));

    const key = payload?.data?.key;
    const remoteJid = this.resolverRemoteJid(key);

    if (!remoteJid) {
      this.logger.error(
        'Não foi possível determinar remoteJid válido. Payload ignorado.',
      );
      return;
    }

    const texto: string = (
      payload?.data?.message?.conversation ||
      payload?.data?.message?.extendedTextMessage?.text ||
      ''
    )
      .trim()
      .toLowerCase();

    const nomeContato: string = payload?.data?.pushName || 'Cliente';

    if (!texto) return;

    // Chave de sessão: usa sempre o JID resolvido completo
    const telefone = remoteJid
      .replace('@s.whatsapp.net', '')
      .replace('@lid', '');

    const session = await this.sessionService.getOrCreate(telefone);

    this.logger.log(
      `[${telefone}] Estado: ${session.estado} | Msg: "${texto}"`,
    );

    // Comando global de reset
    if (texto === 'cancelar' || texto === 'sair' || texto === 'menu') {
      await this.sessionService.reset(telefone);
      await this.evolutionService.sendText(
        remoteJid,
        '↩️ Ok, voltando ao início!\n\nDigite *oi* para ver o menu principal.',
      );
      return;
    }

    // Roteamento por estado
    const context = { telefone, remoteJid, texto, nomeContato, session };

    switch (session.estado) {
      case 'INICIO':
      case 'MENU_PRINCIPAL':
        await this.menuHandler.handle(context);
        break;

      case 'VER_PRODUTOS':
      case 'INICIANDO_ENCOMENDA':
      case 'AGUARDANDO_NOME':
      case 'AGUARDANDO_TELEFONE':
      case 'AGUARDANDO_DATA':
      case 'AGUARDANDO_HORA':
      case 'AGUARDANDO_ENTREGA':
      case 'AGUARDANDO_CEP':
      case 'AGUARDANDO_NUMERO_ENDERECO':
      case 'AGUARDANDO_PRODUTOS':
      case 'AGUARDANDO_QUANTIDADE':
        await this.encomendaHandler.handle(context);
        break;

      case 'CONFIRMANDO_PEDIDO':
        await this.confirmacaoHandler.handle(context);
        break;

      default:
        await this.sessionService.reset(telefone);
        await this.menuHandler.handle({ ...context, texto: 'oi' });
    }
  }
}
