import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseInterceptors,
  UploadedFiles,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get('highlights')
  findHighlights() {
    return this.productsService.findHighlights();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(+id);
  }

  @Patch('update-category-price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateCategoryPrice(@Body() body: { categoryId: number; newPrice: number }) {
    return this.productsService.updatePriceByCategory(
      body.categoryId,
      body.newPrice,
    );
  }

  @Patch(':id/highlight')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  toggleHighlight(
    @Param('id') id: string,
    @Body('destaque') destaque: boolean,
  ) {
    return this.productsService.toggleHighlight(+id, destaque);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'funcionario')
  @UseInterceptors(FilesInterceptor('files', 5))
  create(
    @Body() createProductDto: CreateProductDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.productsService.create(createProductDto, files);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'funcionario')
  @UseInterceptors(FilesInterceptor('files', 5))
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    return this.productsService.update(+id, updateProductDto, files);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'funcionario')
  remove(@Param('id') id: string) {
    return this.productsService.remove(+id);
  }
}
