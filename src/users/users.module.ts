// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm'; // Importe o TypeORM
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Usuarios } from './usuarios.entity'; // Importe a nova entidade

@Module({
    imports: [
        // Adiciona o repositório Usuarios para ser injetado no UserService
        TypeOrmModule.forFeature([Usuarios]), 
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService], // Exporte o serviço se outros módulos (como o Auth) precisarem usá-lo
})
export class UsersModule {}