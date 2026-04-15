import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionService } from './evolution.service';
import { SessionService } from './session.service';
import { MenuHandler } from './handlers/menu.handler';
import { EncomendaHandler } from './handlers/encomenda.handler';
import { ConfirmacaoHandler } from './handlers/confirmacao.handler';

@Module({
  imports: [HttpModule],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    EvolutionService,
    SessionService,
    MenuHandler,
    EncomendaHandler,
    ConfirmacaoHandler,
  ],
})
export class WhatsappModule {}