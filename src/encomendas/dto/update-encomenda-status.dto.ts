import { IsEnum, IsNotEmpty } from 'class-validator';
import { EncomendaStatus } from '../encomenda.enums';

export class UpdateEncomendaStatusDto {
  @IsNotEmpty()
  @IsEnum(EncomendaStatus, {
    message: 'Status inválido. Valores permitidos: PENDENTE, CONFIRMADO, EM_PREPARACAO, SAIU_PARA_ENTREGA, ENTREGUE, CONCLUIDO, CANCELADO',
  })
  status: EncomendaStatus;
}