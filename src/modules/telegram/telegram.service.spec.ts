/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { ExpensesService } from '../expenses/expenses.service';
import { UsersService } from '../users/users.service';
import { InvestmentsService } from '../investments/investments.service';
import { Context } from 'telegraf';

describe('TelegramService', () => {
  let service: TelegramService;
  let expensesService: ExpensesService;
  let investmentsService: InvestmentsService;
  let usersService: UsersService;

  const mockExpensesService = {
    createFromTelegram: jest.fn(),
    listExpenses: jest.fn(),
    listCategories: jest.fn(),
  };

  const mockUsersService = {
    getOrCreateUser: jest.fn(),
  };

  const mockInvestmentsService = {
    listUserInvestments: jest.fn(),
  };

  const mockContext = (text: string, telegramId = 12345) =>
    ({
      message: { text },
      from: { id: telegramId },
      reply: jest.fn().mockResolvedValue({} as any),
      replyWithMarkdown: jest.fn().mockResolvedValue({} as any),
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
    expensesService = module.get<ExpensesService>(ExpensesService);
    usersService = module.get<UsersService>(UsersService);
    investmentsService = module.get<InvestmentsService>(InvestmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onListarCommand', () => {
    it('should list expenses for current month when "/listar gastos" is called', async () => {
      const ctx = mockContext('/listar gastos');
      mockExpensesService.listExpenses.mockResolvedValue({
        months: [{
          month: new Date().getMonth(),
          year: new Date().getFullYear(),
          total: 1500.50,
          byCategory: [{ name: 'Alimentação', amount: 500 }, { name: 'Lazer', amount: 1000 }]
        }],
        total: 1500.50
      });

      await service.onListarCommand(ctx);

      expect(mockExpensesService.listExpenses).toHaveBeenCalled();
      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('Relatório de Gastos'),
      );
      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('Alimentação: R$ 500'),
      );
      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('Total: R$ 1500.5'),
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
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('• Alimentação\n• Lazer'),
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
          }
        ],
        totalProfit: 150,
        totalAllocation: 350
      });

      await service.onListarCommand(ctx);

      expect(mockInvestmentsService.listUserInvestments).toHaveBeenCalledWith(12345n);
      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('Carteira de Investimentos'),
      );
      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('PETR4'),
      );
      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('Lucro Total: +R$ 150'),
      );
    });

    it('should handle investments with unavailable price', async () => {
        const ctx = mockContext('/listar investimentos');
        mockInvestmentsService.listUserInvestments.mockResolvedValue({
          assets: [
            {
              ticker: 'VALE3',
              position: 10,
              pm: 100,
              currentPrice: null,
              allocation: null,
              profit: null,
              profitPercentage: null,
            }
          ],
          totalProfit: 0,
          totalAllocation: 0
        });
  
        await service.onListarCommand(ctx);
  
        expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
          expect.stringContaining('Preço indisponível'),
        );
      });

    it('should reply with error for invalid subcommands', async () => {
      const ctx = mockContext('/listar xpto');
      await service.onListarCommand(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Tipo de listagem inválido'),
      );
    });
  });
});
