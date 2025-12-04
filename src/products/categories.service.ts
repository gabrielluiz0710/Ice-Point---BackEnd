import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoryRepo: Repository<Category>,
  ) {}

  async findAll() {
    return this.categoryRepo.find({
      order: { nome: 'ASC' },
    });
  }

  async create(nome: string, descricao?: string) {
    const newCat = this.categoryRepo.create({ nome, descricao });
    return this.categoryRepo.save(newCat);
  }
}