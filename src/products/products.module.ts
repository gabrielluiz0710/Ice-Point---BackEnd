import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { CategoriesService } from './categories.service'; 
import { CategoriesController } from './categories.controller';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { Category } from './entities/category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductImage, Category])
  ],
  controllers: [ProductsController, CategoriesController], 
  providers: [ProductsService, CategoriesService], 
  exports: [ProductsService]
})
export class ProductsModule {}