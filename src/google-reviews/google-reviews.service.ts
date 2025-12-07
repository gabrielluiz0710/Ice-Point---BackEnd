import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GoogleReviewsService {
  private readonly logger = new Logger(GoogleReviewsService.name);
  
  private cache: any = null;
  private lastFetch: number = 0;
  
  // 30 dias em milissegundos (1000ms * 60s * 60m * 24h * 7d)
  private readonly CACHE_DURATION = 1000 * 60 * 60 * 24 * 7; 

  constructor(private readonly httpService: HttpService) {}

  async getReviews() {
    const now = Date.now();

    if (this.cache && (now - this.lastFetch < this.CACHE_DURATION)) {
      this.logger.log('Retornando reviews do CACHE (Válido por 7 dias)');
      return this.cache;
    }

    this.logger.log('Cache expirado ou inexistente. Buscando na API do Google...');
    
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID;
    
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&language=pt-BR&key=${apiKey}`;

    try {
      const { data } = await firstValueFrom(this.httpService.get(url));
      
      if (data.status !== 'OK') {
        throw new Error(`Erro Google API: ${data.status}`);
      }

      const formattedData = {
        rating: data.result.rating, 
        total_reviews: data.result.user_ratings_total, 
        reviews: data.result.reviews.map((review) => ({
          author_name: review.author_name,
          profile_photo_url: review.profile_photo_url,
          rating: review.rating,
          relative_time_description: review.relative_time_description,
          text: review.text,
        }))
      };

      this.cache = formattedData;
      this.lastFetch = now;

      return this.cache;

    } catch (error) {
      this.logger.error('Falha ao buscar reviews', error);
      return this.cache || [];
    }
  }
}