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
  };

  const mockUsersService = {
    getOrCreateUser: jest.fn(),
  };

  const mockInvestmentsService = {
    listUserInvestments: jest.fn(),
    listIndividualOperations: jest.fn(),
    deleteOperation: jest.fn(),
  };

  const mockContext = (text: string, telegramId = 12345) =>
    ({
      message: { text },
      from: { id: telegramId },
      reply: jest.fn().mockResolvedValue({} as any),
      replyWithMarkdown: jest.fn().mockResolvedValue({} as any),
      editMessageText: jest.fn().mockResolvedValue({} as any),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      match: [] as string[],
      update: {
        callback_query: {
          data: '',
          message: { text: 'Mensagem original' },
        },
      },
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

    it('should list investments when "/listar investimentos" is called', async () => {
      const ctx = mockContext('/listar investimentos');
      mockInvestmentsService.listUserInvestments.mockResolvedValue({
        assets: [
          {
            ticker: 'PETR4',
            position: 10,
            pm: 20,
            currentPrice: 35,
            allocation: 350,
            profit: 150,
            profitPercentage: 75,
          },
        ],
        totalProfit: 150,
        totalAllocation: 350,
      });

      await service.onListarCommand(ctx);

      expect(mockInvestmentsService.listUserInvestments).toHaveBeenCalledWith(
        12345n,
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
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        }),
      );
    });

    it('should list categories with delete buttons', async () => {
      const ctx = mockContext('/deletar categorias');
      mockExpensesService.listCategories.mockResolvedValue([
        { id: 'cat-1', name: 'Lazer' },
      ]);

      await service.onDeletarCommand(ctx);

      expect(mockExpensesService.listCategories).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Escolha a categoria para deletar:'),
        expect.any(Object),
      );
    });
  });

  describe('Actions', () => {
    it('should handle "del:exp" action by asking for confirmation', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['del:exp:exp-1', 'exp', 'exp-1'];

      await service.onDeleteAction(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Deseja realmente deletar este item?'),
        expect.objectContaining({
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.any(Array),
          }),
        }),
      );
    });

    it('should handle "conf_del:exp" action by deleting and confirming', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['conf_del:exp:exp-1', 'exp', 'exp-1'];

      await service.onConfirmDeleteAction(ctx);

      expect(mockExpensesService.deleteExpense).toHaveBeenCalledWith(
        'exp-1',
        12345n,
      );
      expect(ctx.editMessageText).toHaveBeenCalledWith('Excluído com sucesso ✅');
    });

    it('should handle "canc_del" action by cancelling', async () => {
      const ctx = mockContext('');

      await service.onCancelDeleteAction(ctx);

      expect(ctx.editMessageText).toHaveBeenCalledWith('Operação cancelada ❌');
    });
  });
});
