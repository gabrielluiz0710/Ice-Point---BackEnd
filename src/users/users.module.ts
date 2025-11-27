import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Usuarios } from './usuarios.entity';
import { Enderecos } from '../enderecos/enderecos.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Usuarios,
            Enderecos
        ]), 
    ],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule {}