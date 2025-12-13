import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  
  private readonly DESTINATION = 'Av. Padre Eddie Bernardes da Silva, 965 - Lourdes, Uberaba - MG, 38035-230';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async calculateShippingFee(addressData: { street: string; number: string; city: string; state: string; cep: string }) {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_SHIPPING_API_KEY');
    
    if (!apiKey) {
      this.logger.error('GOOGLE_MAPS_SHIPPING_API_KEY não configurada');
      throw new BadRequestException('Erro interno de configuração de API');
    }

    const fullOrigin = `${addressData.street}, ${addressData.number}, ${addressData.city} - ${addressData.state}`;
    
    let distanceInMeters = await this.getDistance(fullOrigin, apiKey);

    if (distanceInMeters === null) {
      this.logger.warn(`Não foi possível calcular pelo endereço "${fullOrigin}". Tentando pelo CEP...`);
      const cepOrigin = addressData.cep;
      distanceInMeters = await this.getDistance(cepOrigin, apiKey);
    }

    if (distanceInMeters === null) {
        throw new BadRequestException('Não foi possível calcular a distância para este endereço. Verifique os dados.');
    }

    const price = distanceInMeters >= 9000 ? 30 : 20;

    return {
      distance: (distanceInMeters / 1000).toFixed(1) + ' km',
      fee: price
    };
  }

  private async getDistance(origin: string, apiKey: string): Promise<number | null> {
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(this.DESTINATION);

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodedOrigin}&destinations=${encodedDestination}&key=${apiKey}&language=pt-BR`;

    try {
      const { data } = await firstValueFrom(this.httpService.get(url));

      if (data.status !== 'OK') {
        this.logger.error(`Erro na API Google: ${data.status}`);
        return null;
      }

      const element = data.rows[0].elements[0];

      if (element.status !== 'OK') {
        return null;
      }

      return element.distance.value;

    } catch (error) {
      this.logger.error('Falha na requisição ao Google Maps', error);
      return null;
    }
  }
}