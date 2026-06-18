import {
  IsString,
  IsOptional,
  IsEmail,
  IsNotEmpty,
  IsIn,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class CreateUserAdminDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  nome: string;

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

  /**
   * UUID opcional: usado quando o usuário já existe no Supabase Auth
   * e precisamos apenas criar o registro na tabela local.
   */
  @IsOptional()
  @IsUUID()
  id?: string;
}
