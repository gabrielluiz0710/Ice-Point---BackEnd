import { IsOptional, IsDateString, IsIn } from 'class-validator';

export class GetDashboardDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['revenue', 'quantity'])
  sortBy?: 'revenue' | 'quantity';
}
