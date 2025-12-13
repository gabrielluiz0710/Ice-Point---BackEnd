import { Body, Controller, Post } from '@nestjs/common';
import { ShippingService } from './shipping.service';

@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('calculate')
  async calculate(@Body() addressData: { street: string; number: string; city: string; state: string; cep: string }) {
    return this.shippingService.calculateShippingFee(addressData);
  }
}