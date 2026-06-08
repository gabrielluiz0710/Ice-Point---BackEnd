import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappAdminController } from './whatsapp.admin.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionService } from './evolution.service';
import { SessionService } from './session.service';
import { AiService } from './ai.service';
import { MenuHandler } from './handlers/menu.handler';
import { CardapioHandler } from './handlers/cardapio.handler';
import { InfoHandler } from './handlers/info.handler';
import { EncomendaHandler } from './handlers/encomenda.handler';
import { ConfirmacaoHandler } from './handlers/confirmacao.handler';
import { ShippingService } from '../shipping/shipping.service';
import { MailService } from '../mail/mail.service';
import { CalendarService } from '../calendar/calendar.service';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [WhatsappController, WhatsappAdminController],
  providers: [
    WhatsappService,
    EvolutionService,
    SessionService,
    AiService,
    MenuHandler,
    CardapioHandler,
    InfoHandler,
    EncomendaHandler,
    ConfirmacaoHandler,
    ShippingService,
    MailService,
    CalendarService,
  ],
})
export class WhatsappModule {}
