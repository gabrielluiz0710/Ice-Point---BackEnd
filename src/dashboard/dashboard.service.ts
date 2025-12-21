import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encomendas } from '../encomendas/encomendas.entity';
import { EncomendaItens } from '../encomendas/encomenda-itens.entity';
import { GetDashboardDto } from './dto/dashboard.dto';
import { EncomendaStatus, MetodoEntrega } from '../encomendas/encomenda.enums';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Encomendas)
    private encomendasRepo: Repository<Encomendas>,
    @InjectRepository(EncomendaItens)
    private itensRepo: Repository<EncomendaItens>,
  ) {}

  private get validStatuses() {
    return [
      EncomendaStatus.CONFIRMADO,
      EncomendaStatus.EM_PREPARACAO,
      EncomendaStatus.SAIU_PARA_ENTREGA,
      EncomendaStatus.ENTREGUE,
      EncomendaStatus.CONCLUIDO,
    ];
  }

  private applyDateFilter(
    qb: any,
    filters: GetDashboardDto,
    dateField = 'encomenda.data_solicitacao',
  ) {
    if (filters.startDate) {
      qb.andWhere(`${dateField}::date >= :startDate`, {
        startDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      qb.andWhere(`${dateField}::date <= :endDate`, { endDate: filters.endDate });
    }
  }

  async getExecutiveKPIs(filters: GetDashboardDto) {
    const qb = this.encomendasRepo.createQueryBuilder('encomenda');
    this.applyDateFilter(qb, filters);

    const revenueData = await qb
      .clone()
      .select('SUM(encomenda.valorTotal)', 'totalRevenue')
      .addSelect('COUNT(encomenda.id)', 'totalOrders')
      .andWhere('encomenda.status IN (:...statuses)', {
        statuses: this.validStatuses,
      })
      .getRawOne();

    const allData = await qb
      .clone()
      .select('COUNT(encomenda.id)', 'totalRequests')
      .addSelect(
        "SUM(CASE WHEN encomenda.status = 'CANCELADO' THEN 1 ELSE 0 END)",
        'totalCancelled',
      )
      .addSelect(
        "SUM(CASE WHEN encomenda.status = 'CANCELADO' THEN encomenda.valorTotal ELSE 0 END)",
        'lostRevenue',
      )
      .andWhere('encomenda.status != :pendingStatus', {
        pendingStatus: EncomendaStatus.PENDENTE,
      })
      .getRawOne();

    const itensQuery = this.itensRepo
      .createQueryBuilder('item')
      .leftJoin('item.encomenda', 'encomenda')
      .select('SUM(item.quantidade)', 'totalItens')
      .where('encomenda.status IN (:...statuses)', {
        statuses: this.validStatuses,
      });

    this.applyDateFilter(itensQuery, filters);
    const itensData = await itensQuery.getRawOne();

    const totalRevenue = Number(revenueData?.totalRevenue) || 0;
    const successfulOrders = Number(revenueData?.totalOrders) || 0;
    const totalItens = Number(itensData?.totalItens) || 0;
    const totalRequests = Number(allData?.totalRequests) || 0;
    const totalCancelled = Number(allData?.totalCancelled) || 0;
    const lostRevenue = Number(allData?.lostRevenue) || 0;

    return {
      faturamentoBruto: totalRevenue,
      ticketMedio: successfulOrders > 0 ? totalRevenue / successfulOrders : 0,
      itensPorCesta: successfulOrders > 0 ? totalItens / successfulOrders : 0,
      totalPedidosConcluidos: successfulOrders,
      taxaCancelamento:
        totalRequests > 0 ? (totalCancelled / totalRequests) * 100 : 0,
      receitaPerdida: lostRevenue,
    };
  }

  async getSalesOverTime(filters: GetDashboardDto) {
    const qb = this.encomendasRepo
      .createQueryBuilder('encomenda')
      .select("TO_CHAR(encomenda.data_solicitacao, 'YYYY-MM-DD')", 'data')
      .addSelect('SUM(encomenda.valorTotal)', 'valor')
      .andWhere('encomenda.status IN (:...statuses)', {
        statuses: this.validStatuses,
      })
      .groupBy('data')
      .orderBy('data', 'ASC');

    this.applyDateFilter(qb, filters);
    const result = await qb.getRawMany();

    return result.map((r) => ({ data: r.data, valor: Number(r.valor) }));
  }

  async getSalesHeatmap(filters: GetDashboardDto) {
    const qb = this.encomendasRepo
      .createQueryBuilder('encomenda')
      .select('EXTRACT(DOW FROM encomenda.data_solicitacao)', 'diaSemana')
      .addSelect('EXTRACT(HOUR FROM encomenda.data_solicitacao)', 'hora')
      .addSelect('COUNT(encomenda.id)', 'qtdPedidos')
      .andWhere('encomenda.status IN (:...statuses)', {
        statuses: this.validStatuses,
      })
      .groupBy('"diaSemana"')
      .addGroupBy('"hora"');

    this.applyDateFilter(qb, filters);
    return qb.getRawMany();
  }

  async getTopProducts(filters: GetDashboardDto) {
    const qb = this.itensRepo
      .createQueryBuilder('item')
      .leftJoin('item.encomenda', 'encomenda')
      .leftJoin('item.produto', 'produto')
      .select('produto.nome', 'nome')
      .addSelect('SUM(item.quantidade)', 'quantidadeVendida')
      .addSelect(
        'SUM(item.quantidade * item.precoUnitarioCongelado)',
        'valorGerado',
      )
      .where('encomenda.status IN (:...statuses)', {
        statuses: this.validStatuses,
      })
      .groupBy('produto.id')
      .addGroupBy('produto.nome')
      .limit(10);

    if (filters.sortBy === 'quantity') {
      qb.orderBy('"quantidadeVendida"', 'DESC');
    } else {
      qb.orderBy('"valorGerado"', 'DESC');
    }

    this.applyDateFilter(qb, filters, 'encomenda.data_solicitacao');

    const result = await qb.getRawMany();
    return result.map((r) => ({
      nome: r.nome,
      quantidade: Number(r.quantidadeVendida),
      receita: Number(r.valorGerado),
    }));
  }

  async getCategoryPerformance(filters: GetDashboardDto) {
    const qb = this.itensRepo
      .createQueryBuilder('item')
      .leftJoin('item.encomenda', 'encomenda')
      .leftJoin('item.produto', 'produto')
      .leftJoin('produto.categoria', 'categoria')
      .select('categoria.nome', 'categoria')
      .addSelect('SUM(item.quantidade * item.precoUnitarioCongelado)', 'total')
      .where('encomenda.status IN (:...statuses)', {
        statuses: this.validStatuses,
      })
      .groupBy('categoria.id')
      .addGroupBy('categoria.nome');

    this.applyDateFilter(qb, filters, 'encomenda.data_solicitacao');

    const result = await qb.getRawMany();
    return result.map((r) => ({
      category: r.categoria || 'Sem Categoria',
      total: Number(r.total),
    }));
  }

  async getOperationalStats(filters: GetDashboardDto) {
    const qb = this.encomendasRepo.createQueryBuilder('encomenda');
    this.applyDateFilter(qb, filters);

    const methods = await qb
      .clone()
      .select('encomenda.metodoEntrega', 'metodo')
      .addSelect('COUNT(encomenda.id)', 'count')
      .andWhere('encomenda.status IN (:...statuses)', {
        statuses: this.validStatuses,
      })
      .groupBy('encomenda.metodoEntrega')
      .getRawMany();

    const topNeighborhoods = await qb
      .clone()
      .select('encomenda.enderecoBairro', 'bairro')
      .addSelect('COUNT(encomenda.id)', 'count')
      .andWhere('encomenda.status IN (:...statuses)', {
        statuses: this.validStatuses,
      })
      .andWhere("encomenda.metodoEntrega = :deliveryMethod", { 
         deliveryMethod: MetodoEntrega.DELIVERY 
      })
      .andWhere('encomenda.enderecoBairro IS NOT NULL')
      .andWhere("encomenda.enderecoBairro != ''") 
      .groupBy('encomenda.enderecoBairro')
      .orderBy('count', 'DESC')
      .limit(8)
      .getRawMany();

    const cancelReasons = await qb
      .clone()
      .select('encomenda.motivoCancelamento', 'motivo')
      .addSelect('COUNT(encomenda.id)', 'count')
      .andWhere("encomenda.status = 'CANCELADO'")
      .groupBy('encomenda.motivoCancelamento')
      .getRawMany();

    return {
      metodosEntrega: methods,
      topBairros: topNeighborhoods,
      motivosCancelamento: cancelReasons,
    };
  }

  async getClientRetention(filters: GetDashboardDto) {
    if (!filters.startDate) {
      return { novos: 0, recorrentes: 0 };
    }

    const endDate = filters.endDate || new Date().toISOString().split('T')[0];

    const qb = this.encomendasRepo.manager
      .createQueryBuilder()
      .select(
        'COUNT(DISTINCT CASE WHEN COALESCE(previous_orders.total_anterior, 0) = 0 THEN current_period.cliente_id END)',
        'novos',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN previous_orders.total_anterior > 0 THEN current_period.cliente_id END)',
        'recorrentes',
      )
      .from((subQuery) => {
        return subQuery
          .select('COALESCE(e.email_cliente, e.cpf_cliente) as cliente_id')
          .from(Encomendas, 'e')
          .where(
            'e.data_solicitacao::date >= :start AND e.data_solicitacao::date <= :end',
            {
              start: filters.startDate,
              end: endDate,
            },
          )
          .andWhere('e.status IN (:...statuses)', {
            statuses: this.validStatuses,
          })
          .andWhere(
            '(e.email_cliente IS NOT NULL OR e.cpf_cliente IS NOT NULL)',
          );
      }, 'current_period')
      .leftJoin(
        (subQuery) => {
          return subQuery
            .select(
              'COALESCE(e2.email_cliente, e2.cpf_cliente) as cliente_id_antigo',
            )
            .addSelect('COUNT(e2.id)', 'total_anterior')
            .from(Encomendas, 'e2')
            .where('e2.data_solicitacao::date < :historyStart', {
              historyStart: filters.startDate,
            })
            .andWhere('e2.status IN (:...statuses)', {
              statuses: this.validStatuses,
            })
            .groupBy('cliente_id_antigo');
        },
        'previous_orders',
        'previous_orders.cliente_id_antigo = current_period.cliente_id',
      );

    const result = await qb.getRawOne();

    return {
      novos: Number(result?.novos) || 0,
      recorrentes: Number(result?.recorrentes) || 0,
    };
  }

  async getTopClients(filters: GetDashboardDto) {
    const qb = this.encomendasRepo
      .createQueryBuilder('encomenda')
      .select('encomenda.nomeCliente', 'nome')
      .addSelect('encomenda.telefoneCliente', 'telefone')
      .addSelect('COUNT(encomenda.id)', 'qtdPedidos')
      .addSelect('SUM(encomenda.valorTotal)', 'totalGasto')
      .andWhere('encomenda.status IN (:...statuses)', {
        statuses: this.validStatuses,
      })
      .groupBy('encomenda.nomeCliente')
      .addGroupBy('encomenda.telefoneCliente')
      .orderBy('"totalGasto"', 'DESC')
      .limit(10);

    this.applyDateFilter(qb, filters);

    const result = await qb.getRawMany();
    return result.map((r) => ({
      nome: r.nome,
      telefone: r.telefone,
      qtdPedidos: Number(r.qtdPedidos),
      totalGasto: Number(r.totalGasto),
    }));
  }
}