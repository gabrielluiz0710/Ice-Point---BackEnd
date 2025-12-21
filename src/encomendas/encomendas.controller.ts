import { 
  Controller, 
  Get, 
  Param, 
  UseGuards, 
  Request, 
  ForbiddenException, 
  NotFoundException,
  ParseIntPipe,
  Patch,
  Body,
  Query,
} from '@nestjs/common';
import { EncomendasService } from './encomendas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CancelarEncomendaDto } from './dto/cancelar-encomenda.dto';
import { RolesGuard } from '../auth/roles.guard'; 
import { Roles } from '../auth/roles.decorator';
import { UpdateEncomendaStatusDto } from './dto/update-encomenda-status.dto';
import { UpdatePagamentoStatusDto } from './dto/update-pagamento-status.dto';

@Controller('encomendas')
export class EncomendasController {
  constructor(private readonly encomendasService: EncomendasService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FUNCIONARIO') 
  @Get('ativas')
  async findActiveOrders(
    @Query('startDate') startDate: string
  ) {
    const date = startDate || new Date().toISOString().split('T')[0];
    return await this.encomendasService.findActiveOrdersByWeek(date);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FUNCIONARIO')
  @Get('detalhes/:id')
  async findOneDetails(@Param('id', ParseIntPipe) id: number) {
    return await this.encomendasService.findOneByAdmin(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findMyOrders(@Request() req) {
    const userId = req.user.userId;
    return await this.encomendasService.findAllByUserEmail(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = req.user.userId;
    return await this.encomendasService.findOneSecure(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancelar')
  async cancelOrder(
    @Request() req, 
    @Param('id', ParseIntPipe) id: number, 
    @Body() cancelDto: CancelarEncomendaDto
  ) {
    const userId = req.user.userId;
    return await this.encomendasService.cancelOrder(id, userId, cancelDto.motivo);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FUNCIONARIO')
  @Patch(':id/status')
  async updateStatus(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateEncomendaStatusDto
  ) {
    const userId = req.user.userId;
    return await this.encomendasService.updateStatus(id, userId, updateDto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'FUNCIONARIO')
  @Patch(':id/pagamento')
  async updatePaymentStatus(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdatePagamentoStatusDto
  ) {
    const userId = req.user.userId;
    return await this.encomendasService.updatePaymentStatus(id, userId, updateDto);
  }
}