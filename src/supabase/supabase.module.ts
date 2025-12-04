import { Module, Global } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Key not found in environment variables.');
}

const supabaseProvider = {
  provide: 'SUPABASE_CLIENT',
  useValue: createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  }),
};

@Global()
@Module({
  providers: [supabaseProvider],
  exports: [supabaseProvider],
})
export class SupabaseModule {}