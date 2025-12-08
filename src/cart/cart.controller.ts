import { Controller, Post, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartTransferDto } from './dto/cart-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; 

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // Já existente (Mantém)
  @UseGuards(JwtAuthGuard)
  @Post('transfer')
  async transferAnonCart(@Request() req, @Body() cartTransferDto: CartTransferDto) {
    const userId: string = req.user.userId; 
    return await this.cartService.transferAnonCart(userId, cartTransferDto.items);
  }

  // NOVO: Busca o carrinho pendente ao carregar a página
  @UseGuards(JwtAuthGuard)
  @Get()
  async getActiveCart(@Request() req) {
    const userId = req.user.userId;
    return await this.cartService.getActiveCart(userId);
  }

  // NOVO: Sincroniza o carrinho (Chamado quando o usuário clica em + ou -)
  @UseGuards(JwtAuthGuard)
  @Put('sync')
  async syncCart(@Request() req, @Body() cartTransferDto: CartTransferDto) {
    const userId = req.user.userId;
    return await this.cartService.syncCart(userId, cartTransferDto.items);
  }
}