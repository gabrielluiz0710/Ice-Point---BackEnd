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

  private resolveNumber(to: string): string {
    if (to.includes('@lid')) return to;
    if (to.includes('@s.whatsapp.net'))
      return to.replace('@s.whatsapp.net', '');
    return to;
  }

  async sendText(to: string, text: string): Promise<void> {
    const number = this.resolveNumber(to);

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
      throw err;
    }
  }

  async sendImage(
    to: string,
    imageUrl: string,
    caption?: string,
  ): Promise<void> {
    const number = this.resolveNumber(to);

    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/message/sendMedia/${this.instance}`,
          {
            number,
            mediatype: 'image',
            mimetype: 'image/webp',
            caption: caption || '',
            media: imageUrl,
          },
          { headers: { apikey: this.apiKey } },
        ),
      );
      this.logger.log(`Imagem enviada para ${number}`);
    } catch (err) {
      this.logger.error(
        `Erro ao enviar imagem para ${number}: ${JSON.stringify(err?.response?.data)}`,
      );
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
