import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Encomendas } from './encomendas.entity';
import { Usuarios } from '../users/usuarios.entity';
import { EncomendaStatus } from './encomenda.enums';

export interface PedidoResumido {
  id: number;
  nome: string;
  status: EncomendaStatus;
  dataCriacao: Date;
  dataAgendada: string;
  total: number;
}

@Injectable()
export class EncomendasService {
  constructor(
    @InjectRepository(Encomendas)
    private readonly encomendaRepository: Repository<Encomendas>,
    @InjectRepository(Usuarios)
    private readonly usuarioRepository: Repository<Usuarios>,
  ) {}

  async findAllByUserEmail(userId: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: userId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const encomendas = await this.encomendaRepository.find({
      where: {
        emailCliente: usuario.email,
        status: Not(EncomendaStatus.PENDENTE),
      },
      order: { dataSolicitacao: 'DESC' },
    });

    const response = {
      ativos: [] as PedidoResumido[],
      historico: [] as PedidoResumido[],
    };

    const statusFinalizados = [
      EncomendaStatus.ENTREGUE,
      EncomendaStatus.CANCELADO,
    ];

    encomendas.forEach((order) => {
      const pedidoResumido: PedidoResumido = {
        id: order.id,
        nome: order.nomeCliente,
        status: order.status,
        dataCriacao: order.dataSolicitacao,
        dataAgendada: order.dataAgendada,
        total: order.valorTotal, 
      };

      if (statusFinalizados.includes(order.status)) {
        response.historico.push(pedidoResumido);
      } else {
        response.ativos.push(pedidoResumido);
      }
    });

    return response;
  }

  async findOneSecure(orderId: number, userId: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: userId },
    });
    if (!usuario) throw new NotFoundException('Usuário inválido.');

    const order = await this.encomendaRepository.findOne({
      where: { id: orderId },
      relations: ['itens', 'itens.produto', 'carrinhos'],
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }

    const isOwnerById = order.clienteId === userId;
    const isOwnerByEmail =
      order.emailCliente?.toLowerCase() === usuario.email.toLowerCase();
    const isAdmin = usuario.tipo === 'ADMIN';

    if (!isOwnerById && !isOwnerByEmail && !isAdmin) {
      throw new ForbiddenException(
        'Você não tem permissão para visualizar este pedido.',
      );
    }

    return order;
  }
}
