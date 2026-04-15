import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private readonly baseUrl = process.env.EVOLUTION_API_URL; // https://evolution.icepoint.com.br
  private readonly apiKey = process.env.EVOLUTION_API_KEY;
  private readonly instance = process.env.EVOLUTION_INSTANCE; // teste-bot

  constructor(private readonly http: HttpService) {}

  private normalizarJid(jid: string): string {
    if (jid.includes('@s.whatsapp.net')) return jid;

    if (jid.includes('@lid')) {
      this.logger.warn(`JID no formato LID recebido: ${jid} - pode falhar`);
      return jid;
    }

    return `${jid}@s.whatsapp.net`;
  }

  private async resolverJid(jid: string): Promise<string> {
    // Formato normal, retorna direto
    if (jid.includes('@s.whatsapp.net')) return jid;

    // Formato LID — busca o número real
    if (jid.includes('@lid')) {
      try {
        const numero = jid.replace('@lid', '');
        const response = await firstValueFrom(
          this.http.post(
            `${this.baseUrl}/chat/whatsappNumbers/${this.instance}`,
            { numbers: [numero] },
            { headers: { apikey: this.apiKey } },
          ),
        );

        const resultado = response.data?.[0];
        if (resultado?.exists && resultado?.jid) {
          this.logger.log(`LID resolvido: ${jid} → ${resultado.jid}`);
          return resultado.jid;
        }
      } catch (err) {
        this.logger.warn(`Não conseguiu resolver LID ${jid}: ${err.message}`);
      }

      // Fallback: tenta enviar direto mesmo assim
      return jid;
    }

    return `${jid}@s.whatsapp.net`;
  }

  async sendText(to: string, text: string): Promise<void> {
    let number: string;

    if (to.includes('@lid')) {
      // Manda JID @lid completo — Evolution recente suporta
      number = to;
    } else if (to.includes('@s.whatsapp.net')) {
      // Remove sufixo, Evolution monta o JID internamente
      number = to.replace('@s.whatsapp.net', '');
    } else {
      number = to;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/message/sendText/${this.instance}`,
          { number, text },
          { headers: { apikey: this.apiKey } },
        ),
      );
      this.logger.log(`Mensagem enviada para ${number}`);
    } catch (err) {
      this.logger.error(
        `Erro ao enviar para ${number}: ${JSON.stringify(err?.response?.data)}`,
      );
      throw err; // re-lança para quem chamou poder tratar
    }
  }

  async sendList(
    to: string,
    title: string,
    text: string,
    buttonLabel: string,
    sections: any[],
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/message/sendList/${this.instance}`,
          {
            number: to,
            title,
            description: text,
            buttonText: buttonLabel,
            sections,
          },
          { headers: { apikey: this.apiKey } },
        ),
      );
    } catch (err) {
      this.logger.warn(`sendList falhou, enviando como texto`, err.message);
      // fallback para texto simples se o tipo não for suportado
      await this.sendText(to, text);
    }
  }
}
