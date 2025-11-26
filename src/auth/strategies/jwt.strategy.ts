// src/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config'; // Importe o serviço de Configuração

// Defina a interface do payload do seu JWT (o que o Supabase coloca no token)
export interface JwtPayload {
  sub: string; // ID do usuário (UUID do auth.users)
  email: string;
  role: string; // Ex: "authenticated"
  iat: number;
  exp: number;
  // O Supabase usa o `sub` para o ID do usuário.
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Use o getOrThrow para garantir que o NestJS falhe se a chave não existir
      secretOrKey: configService.getOrThrow<string>('SUPABASE_JWT_SECRET'), 
      ignoreExpiration: false,
    });
  }

  // Se o token for válido e não expirado, este método é chamado com o payload decodificado.
  async validate(payload: JwtPayload) {
    // Retorna os dados do usuário que serão anexados a `req.user`
    return { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
  }
}