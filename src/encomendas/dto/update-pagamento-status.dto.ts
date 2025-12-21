import { IsNotEmpty, IsString, IsIn } from 'class-validator';

export class UpdatePagamentoStatusDto {
  @IsNotEmpty()
  @IsString()
  @IsIn(['PENDENTE', 'PAGO'], {
    message: 'Status de pagamento inválido. Use PENDENTE ou PAGO.',
  })
  status: string;
}