import { Controller, Post, Body, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('SUPABASE_ADMIN_CLIENT') private readonly supabaseAdmin: SupabaseClient
  ) {}

  @Post('check-email') 
  async checkUserStatus(@Body() body: { email: string }) {
    const { email } = body;

    if (!this.supabaseAdmin) {
      console.error('SUPABASE_ADMIN_CLIENT é null. Verifique SUPABASE_SERVICE_ROLE_KEY no .env');
      throw new HttpException('Configuração de servidor incompleta', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const { data, error } = await this.supabaseAdmin
      .rpc('checar_status_usuario', { email_input: email });

    if (error) {
      console.error('Erro RPC Supabase:', error);
      return { status: 'nao_existe' };
    }

    return { status: data };
  }
}