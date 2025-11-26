// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Não precisamos de JwtModule.register() porque usamos o secret do Supabase
    // e o NestJS não está gerando os tokens, apenas validando.
  ],
  providers: [
    JwtStrategy, // Registra a estratégia de validação JWT
  ],
  exports: [
    PassportModule,
    // Se você tiver serviços de autenticação, exporte-os aqui
  ],
})
export class AuthModule {}