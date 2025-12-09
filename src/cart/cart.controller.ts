import { Controller, Post, Get, Put, Body, UseGuards, Request, Query, BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartTransferDto } from './dto/cart-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; 

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @UseGuards(JwtAuthGuard)
  @Post('transfer')
  async transferAnonCart(@Request() req, @Body() cartTransferDto: CartTransferDto) {
    const userId: string = req.user.userId; 
    return await this.cartService.transferAnonCart(userId, cartTransferDto.items);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getActiveCart(@Request() req) {
    const userId = req.user.userId;
    return await this.cartService.getActiveCart(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('sync')
  async syncCart(@Request() req, @Body() cartTransferDto: CartTransferDto) {
    const userId = req.user.userId;
    return await this.cartService.syncCart(userId, cartTransferDto.items);
  }

  @UseGuards(JwtAuthGuard)
  @Get('availability')
  async checkAvailability(@Query('date') dateString: string) {
    if (!dateString) {
      throw new BadRequestException('Data é obrigatória');
    }
    return await this.cartService.checkAvailability(dateString);
  }
}