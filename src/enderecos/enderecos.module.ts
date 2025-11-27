import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnderecosService } from './enderecos.service';
import { EnderecosController } from './enderecos.controller';
import { Enderecos } from '../enderecos/enderecos.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Enderecos
        ]), 
    ],
    controllers: [EnderecosController],
    providers: [EnderecosService],
    exports: [EnderecosService],
})
export class EnderecosModule {}