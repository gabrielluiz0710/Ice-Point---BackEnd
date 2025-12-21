import { IsOptional, IsDateString } from 'class-validator';

export class GetDashboardDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  sortBy?: 'revenue' | 'quantity';
}