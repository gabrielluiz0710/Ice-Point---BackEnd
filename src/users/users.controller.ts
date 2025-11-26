// src/users/users.controller.ts
import { Controller, Get, UseGuards, Request, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service'; // Importe o serviço

@Controller('users')
export class UsersController {
    // 💡 INJEÇÃO DE DEPENDÊNCIA
    constructor(private readonly usersService: UsersService) {} 

    // Esta rota será o endpoint que o Vue chamará após o login para carregar o perfil.
    @UseGuards(JwtAuthGuard) 
    @Get('profile')
    async getProfile(@Request() req) { // Adicione 'async'
        // 1. Pega o userId do JWT (o que o Passport retornou)
        const userId = req.user.userId;

        // 2. Busca o perfil completo na tabela USUARIOS
        const userProfile = await this.usersService.findProfileByUserId(userId);
        
        // 3. Retorna os dados completos, incluindo o nome!
        return { 
            message: 'Acesso autorizado. Perfil do usuário encontrado.',
            // Retornamos os dados limpos do DB
            user: { 
                userId: userProfile.id,
                email: userProfile.email,
                nome: userProfile.nome, // AGORA O NOME ESTÁ AQUI
                tipo: userProfile.tipo,
                // ... outros dados
            }
        };
    }

    // Rota pública, não protegida por guard
    @Get()
    getPublicData() {
        return { message: 'Dados públicos acessíveis a todos.' };
    }
}