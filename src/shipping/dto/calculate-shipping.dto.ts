import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CalculateShippingDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  number: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  cep: string;

  @IsString()
  @IsOptional()
  neighborhood?: string;
}
