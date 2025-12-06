import { Module, Global } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Key not found in environment variables.');
}

const supabaseProvider = {
  provide: 'SUPABASE_CLIENT',
  useValue: createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  }),
};

const supabaseAdminProvider = {
  provide: 'SUPABASE_ADMIN_CLIENT',
  useValue: supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      })
    : null, 
};

@Global()
@Module({
  providers: [supabaseProvider, supabaseAdminProvider],
  exports: [supabaseProvider, supabaseAdminProvider],
})
export class SupabaseModule {}