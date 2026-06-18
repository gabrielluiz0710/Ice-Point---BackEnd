import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
} from 'class-validator';

export class UpdateUserAdminDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsIn(['ADMIN', 'FUNCIONARIO', 'CLIENTE'])
  tipo?: 'ADMIN' | 'FUNCIONARIO' | 'CLIENTE';

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

  @IsOptional()
  @IsDateString()
  data_nascimento?: string;

  @IsOptional()
  @IsDateString()
  data_admissao?: string;
}
