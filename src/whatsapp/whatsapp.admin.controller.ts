import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { SessionService } from './session.service';
import { EvolutionService } from './evolution.service';

@Controller('whatsapp/admin')
export class WhatsappAdminController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly evolutionService: EvolutionService,
  ) {}

  /**
   * Libera o atendimento humano para um telefone.
   * Após liberar, o bot volta a funcionar para esse número.
   */
  @Post('release')
  @HttpCode(200)
  async releaseHumanMode(@Body() body: { telefone: string }) {
    const telefone = body.telefone?.replace(/\D/g, '');

    if (!telefone) {
      return { ok: false, message: 'Telefone é obrigatório.' };
    }

    await this.sessionService.releaseHumanMode(telefone);

    // Envia mensagem de volta ao cliente informando que o atendimento foi encerrado
    try {
      await this.evolutionService.sendText(
        `${telefone}@s.whatsapp.net`,
        '✅ O atendimento humano foi encerrado.\n\n' +
          'O menu automático está disponível novamente!\n' +
          'Digite *oi* para ver as opções. 🍦',
      );
    } catch {
      // Não falha se não conseguir enviar a msg
    }

    return {
      ok: true,
      message: `Atendimento humano liberado para ${telefone}. Bot reativado.`,
    };
  }

  /**
   * Lista todas as sessões em atendimento humano ativo.
   */
  @Post('list-human')
  @HttpCode(200)
  async listHumanSessions() {
    // Usa Supabase direto para consultar
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );

    const { data } = await supabase
      .from('bot_sessoes')
      .select('telefone, ultima_interacao')
      .eq('atendimento_humano', true)
      .order('ultima_interacao', { ascending: false });

    return {
      ok: true,
      total: data?.length || 0,
      sessoes: data || [],
    };
  }
}
