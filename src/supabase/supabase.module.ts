// src/supabase/supabase.module.ts
import { Module, Global } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

// Aqui usamos a 'anon key' para interações gerais do servidor
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Key not found in environment variables.');
}

const supabaseProvider = {
  provide: 'SUPABASE_CLIENT',
  useValue: createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }, // O NestJS é stateless, não precisa persistir a sessão
  }),
};

@Global()
@Module({
  providers: [supabaseProvider],
  exports: [supabaseProvider],
})
export class SupabaseModule {}