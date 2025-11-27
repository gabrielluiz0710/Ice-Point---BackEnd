import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuarios, UserProfile } from './usuarios.entity';
import { Enderecos } from '../enderecos/enderecos.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuarios)
    private readonly userRepository: Repository<Usuarios>,
    @InjectRepository(Enderecos)
    private readonly enderecoRepository: Repository<Enderecos>,
  ) {}

  async findProfileByUserId(userId: string): Promise<Usuarios> {
    const profile = await this.userRepository.findOne({
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
    return profile;
  }

  async updateProfile(userId: string, data: any) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (data.nome) user.nome = data.nome;
    if (data.email) user.email = data.email;
    if (data.phone) user.telefone = data.phone;
    if (data.cpf) user.cpf = data.cpf;
    if (data.birthDate) user.data_nascimento = data.birthDate;

    await this.userRepository.save(user);

    if (data.address) {
      const addrData = data.address;

      const count = await this.enderecoRepository.count({
        where: { usuarioId: userId },
      });
      const isPrincipal = count === 0 ? true : true;

      if (isPrincipal) {
        await this.enderecoRepository.update(
          { usuarioId: userId },
          { principal: false },
        );
      }

      let existingAddr = await this.enderecoRepository.findOne({
        where: { usuarioId: userId, principal: true },
      });

      if (!existingAddr) {
        existingAddr = new Enderecos();
        existingAddr.usuarioId = userId;
      }

      existingAddr.logradouro = addrData.street;
      existingAddr.numero = addrData.number;
      existingAddr.complemento = addrData.complement;
      existingAddr.bairro = addrData.neighborhood;
      existingAddr.cidade = addrData.city;
      existingAddr.estado = addrData.state;
      existingAddr.cep = addrData.zip;
      existingAddr.principal = true;

      await this.enderecoRepository.save(existingAddr);
    }

    return this.findProfileByUserId(userId);
  }
}
