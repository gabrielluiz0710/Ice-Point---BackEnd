// src/cart/cart.controller.ts
import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { CartService } from './cart.service';
import { CartTransferDto } from './dto/cart-transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Importe seu Guard

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // POST /cart/transfer
  @UseGuards(JwtAuthGuard) // 👈 Garante que só usuários logados podem acessar
  @Post('transfer')
  async transferAnonCart(@Request() req, @Body() cartTransferDto: CartTransferDto) {
    const userId: string = req.user.userId; // Extrai o UUID do usuário logado do JWT
    
    // Envia o UUID do usuário e os itens anônimos para o serviço
    const result = await this.cartService.transferAnonCart(userId, cartTransferDto.items);

    return { 
      message: 'Carrinho transferido e mesclado com sucesso!',
      newCart: result
    };
  }
}