import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { Encomendas } from '../encomendas/encomendas.entity';
import { EncomendaItens } from '../encomendas/encomenda-itens.entity';
import { EncomendasCarrinhos } from '../encomendas/encomendas-carrinhos.entity';
import { Product } from '../products/entities/product.entity'; 
import { Carrinho } from '../carrinhos/carrinho.entity';
import { Usuarios } from '../users/usuarios.entity';
import { MailService } from '../mail/mail.service';
import { CalendarService } from '../calendar/calendar.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Encomendas, EncomendaItens, Product, Carrinho, Usuarios, EncomendasCarrinhos]),
  ],
  controllers: [CartController],
  providers: [CartService, MailService, CalendarService],
})
export class CartModule {}