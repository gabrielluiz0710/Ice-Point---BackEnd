import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GoogleReviewsService } from './google-reviews.service';
import { GoogleReviewsController } from './google-reviews.controller';

@Module({
  imports: [HttpModule],
  controllers: [GoogleReviewsController],
  providers: [GoogleReviewsService],
})
export class GoogleReviewsModule {}