import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In, Between } from 'typeorm';
import { Encomendas } from './encomendas.entity';
import { Usuarios } from '../users/usuarios.entity';
import { EncomendaStatus } from './encomenda.enums';
import { MailService } from '../mail/mail.service';
import { CalendarService } from '../calendar/calendar.service';

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
    private readonly mailService: MailService,
    private readonly calendarService: CalendarService,
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
      EncomendaStatus.CONCLUIDO,
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

  async cancelOrder(orderId: number, userId: string, motivo: string) {
    const usuario = await this.usuarioRepository.findOne({
      where: { id: userId },
    });
    if (!usuario) throw new NotFoundException('Usuário inválido.');

    const order = await this.encomendaRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }

    const isOwnerById = order.clienteId === userId;
    const isOwnerByEmail = order.emailCliente?.toLowerCase() === usuario.email.toLowerCase();
    const canManage = usuario.tipo === 'ADMIN' || usuario.tipo === 'FUNCIONARIO';

    if (!isOwnerById && !isOwnerByEmail && !canManage) {
      throw new ForbiddenException('Você não tem permissão para cancelar este pedido.');
    }

    if (order.status === EncomendaStatus.CANCELADO) {
        throw new BadRequestException('Este pedido já está cancelado.');
    }
    if (order.status === EncomendaStatus.ENTREGUE) {
        throw new BadRequestException('Não é possível cancelar um pedido já entregue.');
    }
    if (order.status === EncomendaStatus.CONCLUIDO) {
        throw new BadRequestException('Não é possível cancelar um pedido já concluído.');
    }

    order.status = EncomendaStatus.CANCELADO;
    order.motivoCancelamento = motivo;

    const savedOrder = await this.encomendaRepository.save(order);

    if (savedOrder.googleEventId) {
      this.calendarService.deleteOrderEvent(savedOrder.googleEventId);
    }

    try {
      const admins = await this.usuarioRepository.find({
        where: { tipo: 'ADMIN' },
        select: ['email'],
      });
      const adminEmails = admins.map((u) => u.email).filter((e) => !!e);

      this.mailService.sendCancellationEmails(savedOrder, adminEmails);
    } catch (error) {
      console.error('Erro ao tentar enviar email de cancelamento:', error);
    }

    return savedOrder;
  }

  async findActiveOrdersByWeek(startDateStr: string) {
    // 1. Converter a string de data inicial para objeto Date
    const startDate = new Date(startDateStr);
    
    // Validar se a data é válida
    if (isNaN(startDate.getTime())) {
       throw new BadRequestException('Data inicial inválida.');
    }

    // 2. Calcular a data final (Start Date + 7 dias)
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    // Formatar para YYYY-MM-DD para garantir compatibilidade com coluna type: 'date'
    // Nota: Dependendo do driver do banco, objetos Date funcionam, mas strings são mais seguras para comparadores de data pura.
    const startIso = startDate.toISOString().split('T')[0];
    const endIso = endDate.toISOString().split('T')[0];

    // 3. Definir status que NÃO queremos (histórico)
    const statusFinalizados = [
      EncomendaStatus.CONCLUIDO,
      EncomendaStatus.CANCELADO,
      EncomendaStatus.PENDENTE 
    ];

    const encomendas = await this.encomendaRepository.find({
      where: {
        // Busca onde status NÃO é concluído/cancelado
        status: Not(In(statusFinalizados)),
        // Busca no intervalo de datas
        dataAgendada: Between(startIso, endIso),
      },
      order: {
        dataAgendada: 'ASC', // Do dia mais próximo para o mais distante
        horaAgendada: 'ASC', // Das primeiras horas do dia para o fim do dia
      },
      relations: ['itens', 'itens.produto'], // Traz os itens se necessário para o front-end de admin
    });

    return {
      periodo: {
        inicio: startIso,
        fim: endIso
      },
      total: encomendas.length,
      data: encomendas
    };
  }
}
