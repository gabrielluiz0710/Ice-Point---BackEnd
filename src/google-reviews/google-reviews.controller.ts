import { Controller, Get } from '@nestjs/common';
import { GoogleReviewsService } from './google-reviews.service';

@Controller('reviews')
export class GoogleReviewsController {
  constructor(private readonly reviewsService: GoogleReviewsService) {}

  @Get()
  async findAll() {
    return this.reviewsService.getReviews();
  }
}