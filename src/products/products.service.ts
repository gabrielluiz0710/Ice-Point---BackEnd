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

  async create(createProductDto: CreateProductDto, files: Array<Express.Multer.File>) {
    let categoryId = createProductDto.categoriaId;

    // 1. Lógica de Criação de Categoria Automática
    if (createProductDto.novaCategoria) {
      const existing = await this.categoryRepo.createQueryBuilder('cat')
        .where('LOWER(cat.nome) = LOWER(:nome)', { nome: createProductDto.novaCategoria })
        .getOne();

      if (existing) {
        categoryId = existing.id;
      } else {
        const newCat = this.categoryRepo.create({ nome: createProductDto.novaCategoria });
        const savedCat = await this.categoryRepo.save(newCat);
        categoryId = savedCat.id;
      }
    }

    // 2. Conversão e Tratamento de Tipos
    const isDisponivel = String(createProductDto.disponivel) === 'true';
    const preco = Number(createProductDto.preco_unitario);
    
    // CORREÇÃO DO ERRO AQUI:
    // O TypeORM prefere 'undefined' ao invés de 'null' na criação para campos opcionais
    const categoriaRelation = categoryId ? { id: Number(categoryId) } : undefined;

    const newProduct = this.productRepo.create({
      ...createProductDto,
      preco_unitario: preco,
      disponivel: isDisponivel,
      categoria: categoriaRelation, // Aqui usamos a variável corrigida
      informacaoNutricional: typeof createProductDto.informacaoNutricional === 'string' 
        ? JSON.parse(createProductDto.informacaoNutricional) 
        : createProductDto.informacaoNutricional
    });

    // Limpeza de propriedades que não existem na entidade Product
    // Isso evita erros se o DTO tiver campos a mais que o banco não aceita
    delete (newProduct as any).categoriaId;
    delete (newProduct as any).novaCategoria;

    const savedProduct = await this.productRepo.save(newProduct);

    // 3. Upload de Imagens
    if (files && files.length > 0) {
      await this.processAndUploadImages(savedProduct, files);
    }

    return this.findOne(savedProduct.id);
  }

  async update(id: number, updateProductDto: UpdateProductDto, files: Array<Express.Multer.File>) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Validar existência (Leitura fora da transação ou dentro, tanto faz)
      const product = await this.productRepo.findOne({ where: { id }, relations: ['categoria'] });
      if (!product) throw new BadRequestException('Produto não encontrado');

      const { informacaoNutricional, categoriaId, novaCategoria, disponivel, imagensParaRemover, ...rest } = updateProductDto;

      // 2. Resolver Categoria
      let categoryToSave: Category | null = null;
      if (novaCategoria) {
        // Verifica se existe para não duplicar
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

      // 3. Preparar Objeto de Update (Apenas campos TEXTO/BOOLEAN)
      // Nota: Não passamos 'imagens' aqui para não confundir o TypeORM
      const updateData: any = { ...rest };
      
      if (disponivel !== undefined) updateData.disponivel = String(disponivel) === 'true';
      if (categoryToSave) updateData.categoria = categoryToSave;
      if (informacaoNutricional) {
        updateData.informacaoNutricional = typeof informacaoNutricional === 'string'
          ? JSON.parse(informacaoNutricional)
          : informacaoNutricional;
      }

      // Atualiza dados básicos do produto usando QueryRunner
      await queryRunner.manager.update(Product, id, updateData);

      // 4. DELETAR IMAGENS
      if (imagensParaRemover) {
        const idsParsed = JSON.parse(imagensParaRemover);
        if (Array.isArray(idsParsed) && idsParsed.length > 0) {
          // Buscar caminhos para deletar do Storage depois
          const imagesToDelete = await this.imageRepo.findByIds(idsParsed);
          
          // Deletar do Banco (Dentro da Transação)
          await queryRunner.manager.delete(ProductImage, idsParsed);

          // Deletar do Storage (Assíncrono - se falhar, não aborta a transação do banco, apenas loga)
          // Fazemos isso aqui ou no 'finally', mas aqui já garantimos que o banco aceitou a deleção
          const paths = imagesToDelete.map(img => img.caminhoStorage).filter(p => p);
          if (paths.length > 0) {
             await this.supabase.storage.from('images').remove(paths);
          }
        }
      }

      // 5. UPLOAD NOVAS IMAGENS
      if (files && files.length > 0) {
        for (const [index, file] of files.entries()) {
          const webpBuffer = await sharp(file.buffer)
            .resize({ width: 1000, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

          const fileName = `produtos/${id}/${uuidv4()}.webp`;

          // Upload Storage
          const { error } = await this.supabase.storage
            .from('images')
            .upload(fileName, webpBuffer, { contentType: 'image/webp', upsert: true });

          if (error) throw new InternalServerErrorException('Erro no upload da imagem');

          const { data: { publicUrl } } = this.supabase.storage.from('images').getPublicUrl(fileName);

          // Salvar referência no Banco (Dentro da Transação)
          const newImage = this.imageRepo.create({
            produtoId: id, // Link direto pelo ID para evitar carregar o objeto Product inteiro
            url: publicUrl,
            caminhoStorage: fileName,
            ordem: 99 // Ordem provisória, pode ajustar depois
          });
          await queryRunner.manager.save(newImage);
        }
      }

      // 6. LÓGICA DA CAPA (Recalcular com base no estado final do banco)
      // Buscamos todas as imagens que restaram/entraram para esse produto
      const currentImages = await queryRunner.manager.find(ProductImage, {
        where: { produtoId: id },
        order: { id: 'ASC' }
      });

      let novaCapa: string | null = null;
      if (currentImages.length > 0) {
        // Verifica se a capa atual (que estava no produto) ainda existe na lista
        // Como não carregamos o produto atualizado na memória, vamos assumir:
        // Se tem imagens, a primeira (mais antiga ou definida por ordem) é a capa.
        // Ou mantemos a lógica: se a capa antiga foi deletada, pega a primeira.
        
        // Simples e eficaz: A primeira imagem da lista vira a capa, garantindo que sempre tem capa.
        // Se quiser manter a capa antiga se ela não foi deletada, teria que comparar.
        // Vamos forçar a primeira da lista ser a capa para evitar "capa quebrada".
        novaCapa = currentImages[0].url;
      }

      await queryRunner.manager.update(Product, id, { imagemCapa: novaCapa });

      // COMMIT FINAL
      await queryRunner.commitTransaction();

      // Retorna o produto fresco
      return this.findOne(id);

    } catch (err) {
      await queryRunner.rollbackTransaction();
      console.error('Transaction rolled back:', err);
      throw err;
    } finally {
      await queryRunner.release();
    }
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
        ordem: index // Você pode melhorar a lógica de ordem se quiser somar ao length existente
      });

      // Salvamos a imagem individualmente
      const savedImg = await this.imageRepo.save(newImage);
      uploadedImages.push(savedImg);
    }
    
    return uploadedImages;
  }
}