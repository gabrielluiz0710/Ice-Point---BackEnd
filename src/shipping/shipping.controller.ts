import { Body, Controller, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { CalculateShippingDto } from './dto/calculate-shipping.dto';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async calculate(@Body() addressData: CalculateShippingDto) {
    return this.shippingService.calculateShippingFee(addressData);
  }
}
