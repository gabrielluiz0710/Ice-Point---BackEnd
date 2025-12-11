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
} from '@nestjs/common';
import { EncomendasService } from './encomendas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CancelarEncomendaDto } from './dto/cancelar-encomenda.dto';

@Controller('encomendas')
export class EncomendasController {
  constructor(private readonly encomendasService: EncomendasService) {}

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
}