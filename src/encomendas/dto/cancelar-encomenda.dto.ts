import { IsNotEmpty, IsString } from 'class-validator';

export class CancelarEncomendaDto {
  @IsString()
  @IsNotEmpty({ message: 'O motivo do cancelamento é obrigatório.' })
  motivo: string;
}