import { Injectable } from '@nestjs/common';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { BotSession } from './interfaces/session.interface';

@Injectable()
export class SessionService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    );
  }

  async getOrCreate(telefone: string): Promise<BotSession> {
    const { data } = await this.supabase
      .from('bot_sessoes')
      .select('*')
      .eq('telefone', telefone)
      .single();

    if (data) return data;

    const { data: nova } = await this.supabase
      .from('bot_sessoes')
      .insert({ telefone, estado: 'INICIO', dados_temp: {} })
      .select()
      .single();

    return nova;
  }

  async update(telefone: string, estado: string, dados_temp?: object): Promise<void> {
    const update: any = { estado, ultima_interacao: new Date().toISOString() };
    if (dados_temp !== undefined) update.dados_temp = dados_temp;

    await this.supabase
      .from('bot_sessoes')
      .update(update)
      .eq('telefone', telefone);
  }

  async reset(telefone: string): Promise<void> {
    await this.update(telefone, 'INICIO', {});
  }
}