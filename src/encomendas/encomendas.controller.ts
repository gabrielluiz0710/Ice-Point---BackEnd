import { 
  Controller, 
  Get, 
  Param, 
  UseGuards, 
  Request, 
  ForbiddenException, 
  NotFoundException,
  ParseIntPipe
} from '@nestjs/common';
import { EncomendasService } from './encomendas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}