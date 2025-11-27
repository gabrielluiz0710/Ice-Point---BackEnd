import { Controller, Post, Put, Body, Param, UseGuards, Request, Patch } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnderecosService } from './enderecos.service';

@Controller('enderecos')
export class EnderecosController {
    constructor(private readonly enderecosService: EnderecosService) {} 

    @UseGuards(JwtAuthGuard)
    @Post()
    async create(@Request() req, @Body() body: any) {
        return this.enderecosService.create(req.user.userId, body);
    }

    @UseGuards(JwtAuthGuard)
    @Put(':id')
    async update(@Request() req, @Param('id') id: number, @Body() body: any) {
        return this.enderecosService.update(req.user.userId, id, body);
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':id/principal')
    async setPrincipal(@Request() req, @Param('id') id: number) {
        return this.enderecosService.setPrincipal(req.user.userId, id);
    }
}