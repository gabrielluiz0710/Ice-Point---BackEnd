import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  
  private readonly STORE_ORIGIN = 'Av. Padre Eddie Bernardes da Silva, 965, Lourdes, Uberaba - MG, 38035-230';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async calculateShippingFee(addressData: { street: string; number: string; city: string; state: string; cep: string; neighborhood?: string }) {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_SHIPPING_API_KEY');
    
    if (!apiKey) {
      this.logger.error('GOOGLE_MAPS_SHIPPING_API_KEY não configurada');
      throw new BadRequestException('Erro de configuração no servidor.');
    }

    const destinationString = [
      `${addressData.street}, ${addressData.number}`,
      addressData.neighborhood ? addressData.neighborhood : '',
      `${addressData.city} - ${addressData.state}`,
      `CEP ${addressData.cep}`,
      'Brasil'
    ].filter(Boolean).join(', ');

    this.logger.log(`Calculando frete de: [${this.STORE_ORIGIN}] para [${destinationString}]`);

    const distanceInMeters = await this.getDistanceMatrix(this.STORE_ORIGIN, destinationString, apiKey);

    if (distanceInMeters === null) {
        throw new BadRequestException('Endereço não localizado com precisão. Verifique o número e o CEP.');
    }

    const distanceInKm = distanceInMeters / 1000;

    const price = this.calculatePriceLogic(distanceInKm);

    return {
      distance: distanceInKm.toFixed(2) + ' km',
      fee: price,
      debug_address: destinationString 
    };
  }

  private calculatePriceLogic(km: number): number {
    if (km < 10) return 20;
    return 30;

    /* Cálculo por KM (Exemplo)
    const taxaBase = 10;
    const precoPorKm = 2;
    return taxaBase + (km * precoPorKm);
    */
  }

  private async getDistanceMatrix(origin: string, destination: string, apiKey: string): Promise<number | null> {
    const encodedOrigin = encodeURIComponent(origin);
    const encodedDestination = encodeURIComponent(destination);

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodedOrigin}&destinations=${encodedDestination}&mode=driving&key=${apiKey}&language=pt-BR`;

    try {
      const { data } = await firstValueFrom(this.httpService.get(url));

      if (data.status !== 'OK') {
        this.logger.error(`Google API Error: ${data.status} - ${data.error_message}`);
        return null;
      }

      const row = data.rows[0];
      const element = row.elements[0];

      if (element.status !== 'OK') {
        this.logger.warn(`Element status error: ${element.status} (Provavelmente endereço não encontrado)`);
        return null;
      }

      return element.distance.value;

    } catch (error) {
      this.logger.error('Falha na requisição ao Google Maps', error);
      return null;
    }
  }
}