/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { ExpensesService } from '../expenses/expenses.service';
import { UsersService } from '../users/users.service';
import { InvestmentsService } from '../investments/investments.service';
import { Context } from 'telegraf';

describe('TelegramService', () => {
  let service: TelegramService;

  const mockExpensesService = {
    createFromTelegram: jest.fn(),
    listExpenses: jest.fn(),
    listCategories: jest.fn(),
    listIndividualExpenses: jest.fn(),
    deleteExpense: jest.fn(),
    deleteCategory: jest.fn(),
    updateExpense: jest.fn(),
    updateCategory: jest.fn(),
  };

  const mockUsersService = {
    getOrCreateUser: jest.fn(),
  };

  const mockInvestmentsService = {
    listUserInvestments: jest.fn(),
    listIndividualOperations: jest.fn(),
    deleteOperation: jest.fn(),
    updateOperation: jest.fn(),
  };

  const mockContext = (text: string, telegramId = 12345) =>
    ({
      message: { text },
      from: { id: telegramId },
      session: {},
      reply: jest.fn().mockResolvedValue({} as any),
      replyWithMarkdown: jest.fn().mockResolvedValue({} as any),
<<<<<<< HEAD
      editMessageText: jest.fn().mockResolvedValue({} as any),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      callbackQuery: { data: '' },
      match: [] as string[],
      update: {
        callback_query: {
          data: '',
          message: { text: 'Mensagem original' },
        },
      },
=======
      answerCbQuery: jest.fn().mockResolvedValue(true),
      callbackQuery: { data: '' },
>>>>>>> c3bc1af (test: adiciona testes para fluxos de callback e sessão no TelegramService)
    }) as unknown as Context;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: ExpensesService, useValue: mockExpensesService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: InvestmentsService, useValue: mockInvestmentsService },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onListarCommand', () => {
    it('should list expenses for current month when "/listar gastos" is called', async () => {
      const ctx = mockContext('/listar gastos');
      mockExpensesService.listExpenses.mockResolvedValue({
        months: [
          {
            month: new Date().getMonth(),
            year: new Date().getFullYear(),
            total: 1500.5,
            byCategory: [
              { name: 'Alimentação', amount: 500 },
              { name: 'Lazer', amount: 1000 },
            ],
          },
        ],
        total: 1500.5,
      });

      await service.onListarCommand(ctx);

      expect(mockExpensesService.listExpenses).toHaveBeenCalled();
      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('Relatório de Gastos'),
      );
    });

    it('should list categories when "/listar categorias" is called', async () => {
      const ctx = mockContext('/listar categorias');
      mockExpensesService.listCategories.mockResolvedValue([
        { name: 'Alimentação' },
        { name: 'Lazer' },
      ]);

      await service.onListarCommand(ctx);

      expect(mockExpensesService.listCategories).toHaveBeenCalledWith(12345n);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Categorias registradas:'),
      );
    });
  });

  describe('onDeletarCommand', () => {
    it('should list individual expenses with delete buttons', async () => {
      const ctx = mockContext('/deletar gastos');
      mockExpensesService.listIndividualExpenses.mockResolvedValue([
        {
          id: 'exp-1',
          amount: 50,
          date: new Date(),
          category: { name: 'Comida' },
        },
      ]);

      await service.onDeletarCommand(ctx);

      expect(mockExpensesService.listIndividualExpenses).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Escolha o item para deletar:'),
        expect.any(Object),
      );
    });
  });

  describe('onEditarCommand', () => {
    it('should list individual expenses for editing when "/editar gastos" is called', async () => {
      const ctx = mockContext('/editar gastos');
      mockExpensesService.listIndividualExpenses.mockResolvedValue([
        {
          id: 'exp-1',
          amount: 50,
          date: new Date(),
          category: { name: 'Comida' },
        },
      ]);

      await service.onEditarCommand(ctx);

      expect(mockExpensesService.listIndividualExpenses).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Escolha um gasto para editar'),
        expect.any(Object),
      );
    });

    it('should list categories for editing when "/editar categorias" is called', async () => {
      const ctx = mockContext('/editar categorias');
      mockExpensesService.listCategories.mockResolvedValue([
        { id: 'cat-1', name: 'Alimentação' },
      ]);

      await service.onEditarCommand(ctx);

      expect(mockExpensesService.listCategories).toHaveBeenCalledWith(12345n);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Escolha uma categoria para editar'),
        expect.any(Object),
      );
    });
  });

<<<<<<< HEAD
  describe('Actions', () => {
=======
  describe('onEditActionHandlers', () => {
>>>>>>> c3bc1af (test: adiciona testes para fluxos de callback e sessão no TelegramService)
    it('should handle edit expense click by setting session and asking field', async () => {
      const ctx = mockContext('');
      (ctx.callbackQuery as any).data = 'edit_exp_123';
      (ctx as any).session = {};

<<<<<<< HEAD
      // @ts-expect-error - testing internal handler
=======
      // @ts-expect-error - testing private/internal handler
>>>>>>> c3bc1af (test: adiciona testes para fluxos de callback e sessão no TelegramService)
      await service.onEditExpense(ctx);

      expect((ctx as any).session.editId).toBe('123');
      expect((ctx as any).session.editType).toBe('expense');
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('O que deseja alterar neste gasto?'),
        expect.any(Object),
      );
<<<<<<< HEAD
    });

    it('should handle "del:exp" action by asking for confirmation', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['del:exp:exp-1', 'exp', 'exp-1'];

      await service.onDeleteAction(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Deseja realmente deletar este item?'),
        expect.any(Object),
      );
    });
  });

  describe('onMessage (Processing Edits)', () => {
    it('should update expense amount when session has edit info', async () => {
      const ctx = mockContext('150.50');
      (ctx as any).session = {
        editType: 'expense',
        editId: 'exp-123',
        editField: 'amount',
      };
      mockExpensesService.updateExpense.mockResolvedValue({});

      await service.onMessage(ctx);

      expect(mockExpensesService.updateExpense).toHaveBeenCalledWith(
        12345n,
        'exp-123',
        { amount: 150.5 },
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Gasto atualizado com sucesso!'),
=======
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it('should handle field selection by asking for new value', async () => {
      const ctx = mockContext('');
      (ctx.callbackQuery as any).data = 'edit_field_amount';
      (ctx as any).session = { editType: 'expense', editId: '123' };

      // @ts-expect-error - testing internal handler
      await service.onEditField(ctx);

      expect((ctx as any).session.editField).toBe('amount');
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Envie o novo valor'),
>>>>>>> c3bc1af (test: adiciona testes para fluxos de callback e sessão no TelegramService)
      );
    });
  });
});
