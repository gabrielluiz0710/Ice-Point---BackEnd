import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncomendasService } from './encomendas.service';
import { EncomendasController } from './encomendas.controller';
import { Encomendas } from './encomendas.entity';
import { Usuarios } from '../users/usuarios.entity'; // Importante para buscar o user

@Module({
  imports: [
    TypeOrmModule.forFeature([Encomendas, Usuarios]),
  ],
  controllers: [EncomendasController],
  providers: [EncomendasService],
  exports: [EncomendasService],
})
export class EncomendasModule {}