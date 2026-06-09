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
      .insert({
        telefone,
        estado: 'INICIO',
        dados_temp: {},
        atendimento_humano: false,
      })
      .select()
      .single();

    return nova;
  }

  async update(
    telefone: string,
    estado: string,
    dados_temp?: object,
  ): Promise<void> {
    const update: any = { estado, ultima_interacao: new Date().toISOString() };
    if (dados_temp !== undefined) update.dados_temp = dados_temp;

    await this.supabase
      .from('bot_sessoes')
      .update(update)
      .eq('telefone', telefone);
  }

  async reset(telefone: string): Promise<void> {
    await this.supabase
      .from('bot_sessoes')
      .update({
        estado: 'INICIO',
        dados_temp: {},
        atendimento_humano: false,
        ultima_interacao: new Date().toISOString(),
      })
      .eq('telefone', telefone);
  }

  async setHumanMode(telefone: string, active: boolean): Promise<void> {
    const update: any = {
      atendimento_humano: active,
      ultima_interacao: new Date().toISOString(),
    };
    if (active) {
      update.estado = 'ATENDIMENTO_HUMANO';
    }

    await this.supabase
      .from('bot_sessoes')
      .update(update)
      .eq('telefone', telefone);
  }

  async releaseHumanMode(telefone: string): Promise<void> {
    await this.supabase
      .from('bot_sessoes')
      .update({
        atendimento_humano: false,
        estado: 'INICIO',
        dados_temp: {},
        ultima_interacao: new Date().toISOString(),
      })
      .eq('telefone', telefone);
  }
}
