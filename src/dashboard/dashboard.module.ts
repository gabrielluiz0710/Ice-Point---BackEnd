import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Encomendas } from '../encomendas/encomendas.entity';
import { EncomendaItens } from '../encomendas/encomenda-itens.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Encomendas, EncomendaItens]), 
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}