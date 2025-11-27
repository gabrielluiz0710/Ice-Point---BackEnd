import { Controller, Get, UseGuards, Request, Put, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {} 

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    async getProfile(@Request() req) {
        const userId = req.user.userId;
        const userProfile = await this.usersService.findProfileByUserId(userId);
        
        const mainAddress = userProfile.enderecos?.find(e => e.principal) || userProfile.enderecos?.[0];

        return { 
            user: { 
                userId: userProfile.id,
                email: userProfile.email,
                nome: userProfile.nome,
                tipo: userProfile.tipo,
                phone: userProfile.telefone, 
                cpf: userProfile.cpf,        
                birthDate: userProfile.data_nascimento,
                addresses: userProfile.enderecos?.map(end => ({
                    id: end.id,
                    street: end.logradouro,
                    number: end.numero,
                    complement: end.complemento,
                    neighborhood: end.bairro,
                    city: end.cidade,
                    state: end.estado,
                    zip: end.cep,
                    principal: end.principal
                })) || []
            }
        };
    }

    @UseGuards(JwtAuthGuard)
    @Put('profile')
    async updateProfile(@Request() req, @Body() body: any) {
        return this.usersService.updateProfile(req.user.userId, body);
    }

    @Get()
    getPublicData() {
        return { message: 'Dados públicos acessíveis a todos.' };
    }
}