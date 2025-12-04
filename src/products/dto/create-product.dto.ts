import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  nome: string;

  @IsOptional()
  @Type(() => Number)
  categoriaId: number;

  @IsOptional()
  @IsString()
  novaCategoria: string;

  @IsOptional()
  @IsString()
  descricao: string;

  @Type(() => Number)
  @IsNumber()
  preco_unitario: number;

  @IsOptional()
  disponivel: any; 

  @IsOptional()
  ingredientes: string;

  @IsOptional()
  alergicos: string;

  @IsOptional()
  informacaoNutricional: string; 

  @IsOptional()
  imagensParaRemover?: string;
}