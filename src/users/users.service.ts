// src/users/users.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuarios, UserProfile } from './usuarios.entity'; // Importe a entidade e a interface

@Injectable()
export class UsersService {
    constructor(
        // Injeta o repositório Usuarios
        @InjectRepository(Usuarios)
        private readonly userRepository: Repository<Usuarios>,
    ) {}

    /**
     * Busca o perfil completo na tabela USUARIOS usando o UUID do JWT.
     * @param userId UUID (string) do usuário logado.
     */
    async findProfileByUserId(userId: string): Promise<UserProfile> {
        // Usa o método findOneBy do TypeORM para buscar pela chave primária 'id'
        const profile = await this.userRepository.findOneBy({ id: userId });

        if (!profile) {
            // Se o usuário fez login (JWT válido) mas o registro na tabela USUARIOS não existe,
            // algo está errado (possível falha no trigger SQL).
            throw new NotFoundException('Perfil de metadados não encontrado no DB.');
        }

        // Retorna o perfil completo que inclui o nome
        return profile;
    }
}