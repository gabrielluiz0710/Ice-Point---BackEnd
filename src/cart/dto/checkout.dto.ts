import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CartItemDto } from './cart-transfer.dto';
import {
  MetodoEntrega,
  MetodoPagamento,
} from '../../encomendas/encomenda.enums';

class PersonalDataDto {
  @IsString() @IsOptional() fullName?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() cpf?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() birthDate?: string;
}

export class CheckoutDto {
  @IsString()
  @IsOptional()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsArray()
  @IsNumber({}, { each: true })
  @IsNotEmpty()
  cartIds: number[];

  @IsString()
  @IsNotEmpty()
  dataAgendada: string;

  @IsString()
  @IsNotEmpty()
  horaAgendada: string;

  @IsEnum(MetodoEntrega)
  metodoEntrega: MetodoEntrega;

  @IsEnum(MetodoPagamento)
  metodoPagamento: MetodoPagamento;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalDataDto)
  personalData?: PersonalDataDto;

  @IsString() @IsOptional() enderecoCep?: string;
  @IsString() @IsOptional() enderecoLogradouro?: string;
  @IsString() @IsOptional() enderecoNumero?: string;
  @IsString() @IsOptional() enderecoComplemento?: string;
  @IsString() @IsOptional() enderecoBairro?: string;
  @IsString() @IsOptional() enderecoCidade?: string;
  @IsString() @IsOptional() enderecoEstado?: string;
}
