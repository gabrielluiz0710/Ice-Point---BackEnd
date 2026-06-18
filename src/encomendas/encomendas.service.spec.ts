import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EncomendasService } from './encomendas.service';
import { Encomendas } from './encomendas.entity';
import { Usuarios } from '../users/usuarios.entity';
import { EncomendaStatus } from './encomenda.enums';
import { MailService } from '../mail/mail.service';
import { CalendarService } from '../calendar/calendar.service';

const makeUsuario = (tipo: 'CLIENTE' | 'FUNCIONARIO' | 'ADMIN' = 'CLIENTE') =>
  ({
    id: 'usuario-uuid-1',
    email: 'cliente@test.com',
    tipo,
  }) as Usuarios;

const makeEncomenda = (overrides: Partial<Encomendas> = {}): Encomendas =>
  ({
    id: 1,
    clienteId: 'usuario-uuid-1',
    emailCliente: 'cliente@test.com',
    status: EncomendaStatus.CONFIRMADO,
    dataAgendada: null,
    horaAgendada: null,
    googleEventId: null,
    motivoCancelamento: null,
    ...overrides,
  }) as unknown as Encomendas;

describe('EncomendasService — cancelOrder', () => {
  let service: EncomendasService;

  const mockEncomendaRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockUsuarioRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockMailService = {
    sendCancellationEmails: jest.fn(),
  };

  const mockCalendarService = {
    deleteOrderEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncomendasService,
        { provide: getRepositoryToken(Encomendas), useValue: mockEncomendaRepo },
        { provide: getRepositoryToken(Usuarios), useValue: mockUsuarioRepo },
        { provide: MailService, useValue: mockMailService },
        { provide: CalendarService, useValue: mockCalendarService },
      ],
    }).compile();

    service = module.get<EncomendasService>(EncomendasService);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // Teste 1: cliente comum pode cancelar com > 2h de antecedência
  // ----------------------------------------------------------------
  it('deve permitir cancelamento se antecedência for maior que 2 horas', async () => {
    const usuario = makeUsuario('CLIENTE');

    // Agendamento daqui a 3 horas (calculado precisamente para o fuso -03:00 do backend)
    const targetTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const localBrasiliaTime = new Date(targetTime.getTime() - 3 * 60 * 60 * 1000);
    const dataStr = localBrasiliaTime.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const horaStr = localBrasiliaTime.toISOString().split('T')[1].slice(0, 5);   // "HH:MM"

    const encomenda = makeEncomenda({ dataAgendada: dataStr, horaAgendada: horaStr });
    const encomendaSalva = { ...encomenda, status: EncomendaStatus.CANCELADO };

    mockUsuarioRepo.findOne.mockResolvedValue(usuario);
    mockEncomendaRepo.findOne.mockResolvedValue(encomenda);
    mockEncomendaRepo.save.mockResolvedValue(encomendaSalva);
    mockUsuarioRepo.find.mockResolvedValue([]);

    const resultado = await service.cancelOrder(1, 'usuario-uuid-1', 'Desisti da festa');

    expect(resultado.status).toBe(EncomendaStatus.CANCELADO);
    expect(mockEncomendaRepo.save).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------------
  // Teste 2: cliente comum NÃO pode cancelar com < 2h de antecedência
  // ----------------------------------------------------------------
  it('deve lançar BadRequestException se antecedência for menor que 2 horas', async () => {
    const usuario = makeUsuario('CLIENTE');

    // Agendamento daqui a 30 minutos (calculado precisamente para o fuso -03:00)
    const targetTime = new Date(Date.now() + 30 * 60 * 1000);
    const localBrasiliaTime = new Date(targetTime.getTime() - 3 * 60 * 60 * 1000);
    const dataStr = localBrasiliaTime.toISOString().split('T')[0];
    const horaStr = localBrasiliaTime.toISOString().split('T')[1].slice(0, 5);

    const encomenda = makeEncomenda({ dataAgendada: dataStr, horaAgendada: horaStr });

    mockUsuarioRepo.findOne.mockResolvedValue(usuario);
    mockEncomendaRepo.findOne.mockResolvedValue(encomenda);

    await expect(
      service.cancelOrder(1, 'usuario-uuid-1', 'Mudei de ideia'),
    ).rejects.toThrow(BadRequestException);

    // Garante que o pedido NÃO foi salvo
    expect(mockEncomendaRepo.save).not.toHaveBeenCalled();
  });

  // ----------------------------------------------------------------
  // Teste 3: ADMIN pode cancelar mesmo com < 2h
  // ----------------------------------------------------------------
  it('deve permitir cancelamento com menos de 2 horas se o usuário for ADMIN', async () => {
    const admin = makeUsuario('ADMIN');

    // Agendamento daqui a 30 minutos (calculado precisamente para o fuso -03:00)
    const targetTime = new Date(Date.now() + 30 * 60 * 1000);
    const localBrasiliaTime = new Date(targetTime.getTime() - 3 * 60 * 60 * 1000);
    const dataStr = localBrasiliaTime.toISOString().split('T')[0];
    const horaStr = localBrasiliaTime.toISOString().split('T')[1].slice(0, 5);

    const encomenda = makeEncomenda({
      dataAgendada: dataStr,
      horaAgendada: horaStr,
      // O pedido pode pertencer a outro cliente — admin gerencia tudo
      clienteId: 'outro-cliente-uuid',
      emailCliente: 'outroclient@test.com',
    });
    const encomendaSalva = { ...encomenda, status: EncomendaStatus.CANCELADO };

    mockUsuarioRepo.findOne.mockResolvedValue(admin);
    mockEncomendaRepo.findOne.mockResolvedValue(encomenda);
    mockEncomendaRepo.save.mockResolvedValue(encomendaSalva);
    mockUsuarioRepo.find.mockResolvedValue([{ email: 'admin@icepoint.com.br' }]);

    const resultado = await service.cancelOrder(1, 'usuario-uuid-1', 'Emergência operacional');

    expect(resultado.status).toBe(EncomendaStatus.CANCELADO);
    expect(mockEncomendaRepo.save).toHaveBeenCalledTimes(1);
  });
});
