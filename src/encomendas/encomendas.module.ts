import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EncomendasService } from './encomendas.service';
import { EncomendasController } from './encomendas.controller';
import { Encomendas } from './encomendas.entity';
import { Usuarios } from '../users/usuarios.entity';
import { MailService } from '../mail/mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Encomendas, Usuarios]),
  ],
  controllers: [EncomendasController],
  providers: [EncomendasService, MailService],
  exports: [EncomendasService],
})
export class EncomendasModule {}