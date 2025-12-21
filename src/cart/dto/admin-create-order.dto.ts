import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MetodoEntrega, MetodoPagamento } from '../../encomendas/encomenda.enums';

class OrderItemDto {
  @IsNumber()
  @IsNotEmpty()
  productId: number;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class AdminCreateOrderDto {
  @IsEmail()
  @IsNotEmpty({ message: 'O email do cliente é obrigatório para identificação.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Nome do cliente é obrigatório.' })
  fullName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  cpf?: string;

  @IsString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  enderecoCep?: string;

  @IsString()
  @IsOptional()
  enderecoLogradouro?: string;

  @IsString()
  @IsOptional()
  enderecoNumero?: string;

  @IsString()
  @IsOptional()
  enderecoBairro?: string;

  @IsString()
  @IsOptional()
  enderecoCidade?: string;

  @IsString()
  @IsOptional()
  enderecoEstado?: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsArray()
  @IsOptional()
  cartIds?: number[];
}