import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard opcional de JWT: tenta autenticar via Bearer Token.
 * - Se o token for válido, popula `req.user` normalmente.
 * - Se não houver token (ou for inválido), permite a requisição continuar com `req.user = null`.
 * Útil para rotas que suportam tanto usuários autenticados quanto guests (checkout anônimo).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    // Retorna o usuário se autenticado, caso contrário retorna null sem lançar erro
    return user ?? null;
  }
}
