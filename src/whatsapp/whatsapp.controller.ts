import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() payload: any, @Headers() headers: any) {
    // A Evolution API espera 200 rápido, processamos async
    this.whatsappService.processMessage(payload).catch(console.error);
    return { ok: true };
  }
}
