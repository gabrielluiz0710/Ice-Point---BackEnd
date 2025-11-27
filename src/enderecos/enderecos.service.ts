import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enderecos } from './enderecos.entity';

@Injectable()
export class EnderecosService {
    constructor(
        @InjectRepository(Enderecos)
        private readonly enderecoRepository: Repository<Enderecos>,
    ) {}

    async create(userId: string, data: any) {
        const count = await this.enderecoRepository.count({ where: { usuarioId: userId } });
        const isPrincipal = data.principal || count === 0;

        if (isPrincipal) {
            await this.desmarcarPrincipal(userId);
        }

        const endereco = this.enderecoRepository.create({
            ...data,
            usuarioId: userId,
            principal: isPrincipal
        });

        return this.enderecoRepository.save(endereco);
    }

    async update(userId: string, enderecoId: number, data: any) {
        const endereco = await this.enderecoRepository.findOne({ where: { id: enderecoId, usuarioId: userId } });
        if (!endereco) throw new NotFoundException('Endereço não encontrado');

        if (data.principal === true) {
            await this.desmarcarPrincipal(userId);
        }

        this.enderecoRepository.merge(endereco, data);
        return this.enderecoRepository.save(endereco);
    }

    async setPrincipal(userId: string, enderecoId: number) {
        await this.desmarcarPrincipal(userId);
        
        const endereco = await this.enderecoRepository.findOne({ where: { id: enderecoId, usuarioId: userId } });
        if (!endereco) throw new NotFoundException('Endereço não encontrado');

        endereco.principal = true;
        return this.enderecoRepository.save(endereco);
    }

    private async desmarcarPrincipal(userId: string) {
        await this.enderecoRepository.update({ usuarioId: userId }, { principal: false });
    }
}