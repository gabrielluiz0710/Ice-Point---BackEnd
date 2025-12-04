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

      let targetAddr = await this.enderecoRepository.findOne({
        where: { usuarioId: userId, principal: true },
      });

      if (!targetAddr) {
         targetAddr = await this.enderecoRepository.findOne({ where: { usuarioId: userId } });
         
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
}
