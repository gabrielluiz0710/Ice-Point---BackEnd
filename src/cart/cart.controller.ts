import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
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
    
    const result = await this.cartService.transferAnonCart(userId, cartTransferDto.items);

    return { 
      message: 'Carrinho transferido e mesclado com sucesso!',
      newCart: result
    };
  }
}