// src/cart/cart.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { Encomendas } from '../encomendas/encomendas.entity';
import { EncomendaItens } from '../encomendas/encomenda-itens.entity';

@Module({
  imports: [
    // Importa as entidades relacionadas ao carrinho para o módulo
    TypeOrmModule.forFeature([Encomendas, EncomendaItens]),
  ],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}