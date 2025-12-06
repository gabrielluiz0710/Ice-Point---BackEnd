import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller'; 
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UsersModule,
    SupabaseModule, 
  ],
  controllers: [
    AuthController,
  ],
  providers: [
    JwtStrategy, 
  ],
  exports: [
    PassportModule,
  ],
})
export class AuthModule {}