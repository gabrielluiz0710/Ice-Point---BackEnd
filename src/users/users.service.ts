import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  InternalServerErrorException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, ILike } from 'typeorm';
import { Usuarios, UserProfile } from './usuarios.entity';
import { Enderecos } from '../enderecos/enderecos.entity';
import { SupabaseClient } from '@supabase/supabase-js';
import * as sharp from 'sharp'; 
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuarios)
    private readonly userRepository: Repository<Usuarios>,
    @InjectRepository(Enderecos)
    private readonly enderecoRepository: Repository<Enderecos>,
    @Inject('SUPABASE_ADMIN_CLIENT')
    private readonly supabaseAdmin: SupabaseClient,
  ) {}

  async findProfileByUserId(userId: string): Promise<Usuarios> {
    let profile = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['enderecos'],
      order: {
        enderecos: {
          principal: 'DESC',
          id: 'ASC',
        },
      },
    });

    if (!profile) throw new NotFoundException('Usuário não encontrado.');

    if (!profile.avatar_url) {
      try {
        const { data: authUser, error } = await this.supabaseAdmin.auth.admin.getUserById(userId);
        
        if (!error && authUser && authUser.user) {
          const metadata = authUser.user.user_metadata;
          const externalPhoto = metadata?.avatar_url || metadata?.picture;

          if (externalPhoto) {
            profile.avatar_url = externalPhoto;
            await this.userRepository.save(profile);
            console.log(`[UsersService] Avatar sincronizado de fonte externa para o user ${userId}`);
          }
        }
      } catch (syncError) {
        console.error('Erro ao tentar sincronizar avatar externo:', syncError);
      }
    }
    return profile;
  }

  async findAllInternal(search?: string): Promise<Usuarios[]> {
    const whereCondition: any = {
      tipo: In(['ADMIN', 'FUNCIONARIO']),
    };

    if (search) {
      whereCondition.nome = ILike(`%${search}%`);
      return this.userRepository.find({
        where: [
          { tipo: In(['ADMIN', 'FUNCIONARIO']), nome: ILike(`%${search}%`) },
          { tipo: In(['ADMIN', 'FUNCIONARIO']), email: ILike(`%${search}%`) },
        ],
        order: { nome: 'ASC' },
      });
    }

    return this.userRepository.find({
      where: whereCondition,
      order: { nome: 'ASC' },
    });
  }

  async findAllClients(search?: string): Promise<Usuarios[]> {
    if (search) {
      return this.userRepository.find({
        where: [
          { tipo: 'CLIENTE', nome: ILike(`%${search}%`) },
          { tipo: 'CLIENTE', email: ILike(`%${search}%`) },
        ],
        order: { nome: 'ASC' },
      });
    }

    return this.userRepository.find({
      where: { tipo: 'CLIENTE' },
      order: { nome: 'ASC' },
    });
  }

  async createAdminUser(data: any, originUrl: string): Promise<Usuarios> {
    const existing = await this.userRepository.findOne({
      where: { email: data.email },
    });
    if (existing)
      throw new BadRequestException('Email já cadastrado no sistema.');

    let newUserId = data.id;

    if (!newUserId) {
      if (!this.supabaseAdmin) {
        throw new BadRequestException('Configuração de Admin do Supabase ausente.');
      }

      const redirectLink = `${originUrl}/atualizar-senha`;

      const { data: authData, error: authError } =
        await this.supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
          redirectTo: redirectLink
        });

      if (authError) {
        console.error('Erro Supabase Invite:', authError); 
        throw new BadRequestException('Erro ao criar usuário no Auth: ' + authError.message);
      }

      newUserId = authData.user.id;
    }

    const newUser = this.userRepository.create({
      id: newUserId,
      nome: data.nome,
      email: data.email,
      tipo: data.tipo || 'FUNCIONARIO',
      telefone: data.telefone,
      cpf: data.cpf,
      data_nascimento: data.data_nascimento || null,
      data_admissao: data.data_admissao || null,     
    });

    return this.userRepository.save(newUser);
  }

  async adminUpdateUser(id: string, data: any): Promise<Usuarios> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (data.nome) user.nome = data.nome;
    if (data.tipo) user.tipo = data.tipo;
    if (data.telefone) user.telefone = data.telefone;
    if (data.cpf) user.cpf = data.cpf;
    if (data.data_nascimento) user.data_nascimento = data.data_nascimento;
    if (data.data_admissao) user.data_admissao = data.data_admissao;

    return this.userRepository.save(user);
  }

  async deleteUser(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (this.supabaseAdmin) {
      await this.supabaseAdmin.auth.admin.deleteUser(id);
    }
  }

  async updateProfile(userId: string, data: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (data.nome) user.nome = data.nome;
    if (data.email) user.email = data.email;
    if (data.phone) user.telefone = data.phone;
    if (data.cpf) user.cpf = data.cpf;
    if (data.birthDate) user.data_nascimento = data.birthDate;

    if (data.avatarUrl) user.avatar_url = data.avatarUrl;

    await this.userRepository.save(user);

    if (data.address) {
      const addrData = data.address;

      let targetAddr = await this.enderecoRepository.findOne({
        where: { usuarioId: userId, principal: true },
      });

      if (!targetAddr) {
        targetAddr = await this.enderecoRepository.findOne({
          where: { usuarioId: userId },
        });

        if (!targetAddr) {
          targetAddr = new Enderecos();
          targetAddr.usuarioId = userId;
        }
      }

      await this.enderecoRepository.update(
        { usuarioId: userId },
        { principal: false },
      );

      targetAddr.logradouro = addrData.street;
      targetAddr.numero = addrData.number;
      targetAddr.complemento = addrData.complement;
      targetAddr.bairro = addrData.neighborhood;
      targetAddr.cidade = addrData.city;
      targetAddr.estado = addrData.state;
      targetAddr.cep = addrData.zip;
      targetAddr.principal = true;

      await this.enderecoRepository.save(targetAddr);
    }

    return this.findProfileByUserId(userId);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ avatarUrl: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    try {
      const webpBuffer = await sharp(file.buffer)
        .resize({ width: 400, height: 400, fit: 'cover' }) 
        .webp({ quality: 80 })
        .toBuffer();

      const fileName = `avatars/${userId}/${uuidv4()}.webp`;

      const { error } = await this.supabaseAdmin.storage
        .from('images')
        .upload(fileName, webpBuffer, { 
          contentType: 'image/webp', 
          upsert: true 
        });

      if (error) {
        console.error('Supabase Storage Error:', error);
        throw new InternalServerErrorException('Erro ao fazer upload da imagem.');
      }

      const { data: { publicUrl } } = this.supabaseAdmin.storage
        .from('images')
        .getPublicUrl(fileName);

      user.avatar_url = publicUrl;
      await this.userRepository.save(user);

      return { avatarUrl: publicUrl };

    } catch (err) {
      console.error('Erro no processamento do avatar:', err);
      throw new InternalServerErrorException('Falha ao processar avatar.');
    }
  }
}
