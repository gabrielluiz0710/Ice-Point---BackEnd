import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { Category } from './entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { createClient } from '@supabase/supabase-js';
import * as sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProductsService {
  private supabase;

  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(ProductImage)
    private imageRepo: Repository<ProductImage>,
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,
    private dataSource: DataSource,
  ) {
    this.supabase = createClient(
      process.env.SUPABASE_URL ?? '', 
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? '' 
    );
  }

  async findAll() {
    return this.productRepo.find({
      relations: ['categoria', 'imagens'],
      order: { id: 'ASC' },
    });
  }

  async findHighlights() {
    return this.productRepo.find({
      where: { 
        destaque: true,
        disponivel: true
      },
      select: {
        id: true,
        nome: true,
        descricao: true,
        preco_unitario: true,
        imagemCapa: true,
        destaque: true
      },
      order: { id: 'DESC' }
    });
  }

  async toggleHighlight(id: number, destaque: boolean) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new BadRequestException('Produto não encontrado');

    await this.productRepo.update(id, { destaque });

    return { 
      message: `Produto "${product.nome}" agora ${destaque ? 'é destaque' : 'não é mais destaque'}`,
      id: product.id,
      destaque: destaque
    };
  }

  async create(createProductDto: CreateProductDto, files: Array<Express.Multer.File>) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let categoryId = createProductDto.categoriaId;

      let categoryToSave: Category | null = null;
      if (createProductDto.novaCategoria) {
        const existing = await this.categoryRepo.findOne({ where: { nome: createProductDto.novaCategoria } });
        if (existing) {
          categoryToSave = existing;
        } else {
          const newCat = this.categoryRepo.create({ nome: createProductDto.novaCategoria });
          categoryToSave = await queryRunner.manager.save(newCat);
        }
      } else if (categoryId) {
      }

      const isDisponivel = String(createProductDto.disponivel) === 'true';
      const preco = Number(createProductDto.preco_unitario);
      
      const newProduct = this.productRepo.create({
        ...createProductDto,
        preco_unitario: preco,
        disponivel: isDisponivel,
        categoria: categoryToSave ? categoryToSave : (categoryId ? { id: Number(categoryId) } as Category : undefined),
        informacaoNutricional: typeof createProductDto.informacaoNutricional === 'string' 
          ? JSON.parse(createProductDto.informacaoNutricional) 
          : createProductDto.informacaoNutricional
      });

      delete (newProduct as any).categoriaId;
      delete (newProduct as any).novaCategoria;

      const savedProduct = await queryRunner.manager.save(newProduct);

      let capaUrl: string | null = null;

      if (files && files.length > 0) {
        for (const [index, file] of files.entries()) {
          const webpBuffer = await sharp(file.buffer)
            .resize({ width: 1000, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

          const fileName = `produtos/${savedProduct.id}/${uuidv4()}.webp`;

          const { error } = await this.supabase.storage
            .from('images')
            .upload(fileName, webpBuffer, { contentType: 'image/webp', upsert: true });

          if (error) throw new InternalServerErrorException('Erro no upload da imagem');

          const { data: { publicUrl } } = this.supabase.storage.from('images').getPublicUrl(fileName);

          if (index === 0) {
            capaUrl = publicUrl;
          }

          const newImage = this.imageRepo.create({
            produtoId: savedProduct.id, 
            url: publicUrl,
            caminhoStorage: fileName,
            ordem: index
          });
          await queryRunner.manager.save(newImage);
        }
      }

      if (capaUrl) {
        await queryRunner.manager.update(Product, savedProduct.id, { imagemCapa: capaUrl });
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedProduct.id);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Erro ao criar produto:', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: number, updateProductDto: UpdateProductDto, files: Array<Express.Multer.File>) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = await this.productRepo.findOne({ where: { id }, relations: ['categoria'] });
      if (!product) throw new BadRequestException('Produto não encontrado');

      const { informacaoNutricional, categoriaId, novaCategoria, disponivel, imagensParaRemover, ...rest } = updateProductDto;

      let categoryToSave: Category | null = null;
      if (novaCategoria) {
        const existingCat = await this.categoryRepo.findOne({ where: { nome: novaCategoria }});
        if (existingCat) {
          categoryToSave = existingCat;
        } else {
          const newCat = this.categoryRepo.create({ nome: novaCategoria });
          categoryToSave = await queryRunner.manager.save(newCat);
        }
      } else if (categoriaId) {
        categoryToSave = await this.categoryRepo.findOne({ where: { id: Number(categoriaId) } });
      }

      const updateData: any = { ...rest };
      
      if (disponivel !== undefined) updateData.disponivel = String(disponivel) === 'true';
      if (categoryToSave) updateData.categoria = categoryToSave;
      if (informacaoNutricional) {
        updateData.informacaoNutricional = typeof informacaoNutricional === 'string'
          ? JSON.parse(informacaoNutricional)
          : informacaoNutricional;
      }

      await queryRunner.manager.update(Product, id, updateData);

      if (imagensParaRemover) {
        const idsParsed = JSON.parse(imagensParaRemover);
        if (Array.isArray(idsParsed) && idsParsed.length > 0) {
          const imagesToDelete = await this.imageRepo.findByIds(idsParsed);
          
          await queryRunner.manager.delete(ProductImage, idsParsed);

          const paths = imagesToDelete.map(img => img.caminhoStorage).filter(p => p);
          if (paths.length > 0) {
             await this.supabase.storage.from('images').remove(paths);
          }
        }
      }

      if (files && files.length > 0) {
        for (const [index, file] of files.entries()) {
          const webpBuffer = await sharp(file.buffer)
            .resize({ width: 1000, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

          const fileName = `produtos/${id}/${uuidv4()}.webp`;

          const { error } = await this.supabase.storage
            .from('images')
            .upload(fileName, webpBuffer, { contentType: 'image/webp', upsert: true });

          if (error) throw new InternalServerErrorException('Erro no upload da imagem');

          const { data: { publicUrl } } = this.supabase.storage.from('images').getPublicUrl(fileName);

          const newImage = this.imageRepo.create({
            produtoId: id, 
            url: publicUrl,
            caminhoStorage: fileName,
            ordem: 99 
          });
          await queryRunner.manager.save(newImage);
        }
      }

      const currentImages = await queryRunner.manager.find(ProductImage, {
        where: { produtoId: id },
        order: { id: 'ASC' }
      });

      let novaCapa: string | null = null;
      if (currentImages.length > 0) {
        novaCapa = currentImages[0].url;
      }

      await queryRunner.manager.update(Product, id, { imagemCapa: novaCapa });

      await queryRunner.commitTransaction();

      return this.findOne(id);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Transaction rolled back:', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

async updatePriceByCategory(categoryId: number, newPrice: number) {
  const category = await this.categoryRepo.findOne({ where: { id: categoryId } });
  if (!category) throw new BadRequestException('Categoria não encontrada');

  await this.productRepo.update(
    { categoria: { id: categoryId } },
    { preco_unitario: newPrice }
  );

  return { message: `Preços da categoria ${category.nome} atualizados para R$ ${newPrice}` };
}

  async remove(id: number) {
    const product = await this.findOne(id);
    if (!product) throw new BadRequestException('Produto não encontrado');

    if (product.imagens && product.imagens.length > 0) {
        const paths = product.imagens.map(img => img.caminhoStorage).filter(p => p);
        if (paths.length > 0) {
            await this.supabase.storage.from('images').remove(paths);
        }
    }

    return this.productRepo.remove(product);
  }

  async findOne(id: number) {
    return this.productRepo.findOne({
      where: { id },
      relations: ['categoria', 'imagens'],
    });
  }

  private async processAndUploadImages(product: Product, files: Array<Express.Multer.File>): Promise<ProductImage[]> {
    const uploadedImages: ProductImage[] = [];

    for (const [index, file] of files.entries()) {
      const webpBuffer = await sharp(file.buffer)
        .resize({ width: 1000, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

      const fileName = `produtos/${product.id}/${uuidv4()}.webp`;

      const { error } = await this.supabase.storage
        .from('images')
        .upload(fileName, webpBuffer, {
          contentType: 'image/webp',
          upsert: true
        });

      if (error) {
        console.error('Erro upload Supabase:', error);
        continue; 
      }

      const { data: { publicUrl } } = this.supabase.storage
        .from('images')
        .getPublicUrl(fileName);

      const newImage = this.imageRepo.create({
        produto: product,
        url: publicUrl,
        caminhoStorage: fileName,
        ordem: index 
      });

      const savedImg = await this.imageRepo.save(newImage);
      uploadedImages.push(savedImg);
    }
    
    return uploadedImages;
  }
}