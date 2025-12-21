import { Controller, Get, Query, UseGuards, Logger, Request, UnauthorizedException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { GetDashboardDto } from './dto/dashboard.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@Query() filters: GetDashboardDto, @Request() req) {
    try {
        const [kpis, salesChart, heatmap, products, operational, retention] = await Promise.all([
            this.dashboardService.getExecutiveKPIs(filters),
            this.dashboardService.getSalesOverTime(filters),
            this.dashboardService.getSalesHeatmap(filters),
            this.dashboardService.getTopProducts(filters),
            this.dashboardService.getOperationalStats(filters),
            this.dashboardService.getClientRetention(filters)
        ]);

        this.logger.log('Dados do dashboard carregados com sucesso.');

        return {
            kpis,
            charts: {
                salesOverTime: salesChart,
                heatmap: heatmap,
                retention: retention
            },
            products,
            operational
        };
    } catch (error) {
        this.logger.error(`Erro ao buscar dados do dashboard: ${error.message}`, error.stack);
        throw error;
    }
  }
  
  @Get('kpis')
  getKpis(@Query() filters: GetDashboardDto, @Request() req) {
    this.logger.log(`Acessando KPIs. User: ${req.user?.email} | Role: ${req.user?.tipo}`);
    return this.dashboardService.getExecutiveKPIs(filters);
  }

  @Get('top-clients')
  getTopClients(@Query() filters: GetDashboardDto) {
      return this.dashboardService.getTopClients(filters);
  }

  @Get('categories')
  getCategories(@Query() filters: GetDashboardDto) {
      return this.dashboardService.getCategoryPerformance(filters);
  }
}