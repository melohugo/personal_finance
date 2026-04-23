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

  describe('start', () => {
    it('should create user and reply welcome message', async () => {
      const ctx = mockContext('/start');
      mockUsersService.getOrCreateUser.mockResolvedValue({});

      await service.start(ctx);

      expect(mockUsersService.getOrCreateUser).toHaveBeenCalledWith(12345n);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Bem-vindo ao FinanceBot!'),
      );
    });
  });

  describe('onStatus', () => {
    it('should reply with online status and uptime', async () => {
      const ctx = mockContext('/status');

      await service.onStatus(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Estou online e operacional!'),
      );
    });
  });

  describe('onGastoCommand', () => {
    it('should register a simple gasto correctly', async () => {
      const ctx = mockContext('/gasto 50.0 Alimentação');
      mockExpensesService.createFromTelegram.mockResolvedValue({});

      await service.onGastoCommand(ctx);

      expect(mockExpensesService.createFromTelegram).toHaveBeenCalledWith({
        telegramId: 12345n,
        amount: 50,
        categoryName: 'Alimentacao',
        date: undefined,
      });
      expect(ctx.reply).toHaveBeenCalledWith(
        'Gasto de R$ 50.00 registrado em Alimentacao! ✅',
      );
    });

    it('should register a gasto with date correctly', async () => {
      const ctx = mockContext('/gasto 50.0 Alimentação 20/04/2026');
      mockExpensesService.createFromTelegram.mockResolvedValue({});

      await service.onGastoCommand(ctx);

      expect(mockExpensesService.createFromTelegram).toHaveBeenCalledWith({
        telegramId: 12345n,
        amount: 50,
        categoryName: 'Alimentacao',
        date: new Date(2026, 3, 20),
      });
      expect(ctx.reply).toHaveBeenCalledWith(
        'Gasto de R$ 50.00 registrado em Alimentacao em 20/04/2026! ✅',
      );
    });

    it('should handle errors and reply to user', async () => {
      const ctx = mockContext('/gasto valor_invalido Categoria');

      await service.onGastoCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Valor inválido'),
      );
    });
  });

  describe('onListarCommand', () => {
    it('should list investments when "/listar investimentos" is called', async () => {
      const ctx = mockContext('/listar investimentos');
      mockInvestmentsService.listUserInvestments.mockResolvedValue({
        assets: [
          {
            ticker: 'PETR4',
            position: 100,
            pm: 30,
            currentPrice: 35,
            profit: 500,
            profitPercentage: 16.67,
          },
        ],
        totalAllocation: 3000,
        totalProfit: 500,
      });

      await service.onListarCommand(ctx);

      expect(mockInvestmentsService.listUserInvestments).toHaveBeenCalledWith(12345n);
      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('Carteira de Investimentos'),
      );
    });

    it('should list expenses for current month when "/listar gastos" is called', async () => {
      const ctx = mockContext('/listar gastos');
      mockExpensesService.listExpenses.mockResolvedValue({
        months: [
          {
            month: new Date().getMonth(),
            year: new Date().getFullYear(),
            total: 1500.5,
            byCategory: [
              { name: 'Alimentacao', amount: 500 },
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
        { name: 'Alimentacao' },
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

  describe('Actions', () => {
    it('should handle edit expense click by setting session and asking field', async () => {
      const ctx = mockContext('');
      (ctx.callbackQuery as any).data = 'edit_exp_123';
      (ctx as any).session = {};

      // @ts-expect-error - testing internal handler
      await service.onEditExpense(ctx);

      expect((ctx as any).session.editId).toBe('123');
      expect((ctx as any).session.editType).toBe('expense');
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('O que deseja alterar neste gasto?'),
        expect.any(Object),
      );
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

    it('should confirm expense deletion', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['conf_del:exp:exp-123', 'exp', 'exp-123'];
      mockExpensesService.deleteExpense.mockResolvedValue({});

      await service.onConfirmDeleteAction(ctx);

      expect(mockExpensesService.deleteExpense).toHaveBeenCalledWith('exp-123', 12345n);
      expect(ctx.editMessageText).toHaveBeenCalledWith('Excluído com sucesso ✅');
    });

    it('should confirm category deletion', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['conf_del:cat:cat-123', 'cat', 'cat-123'];
      mockExpensesService.deleteCategory.mockResolvedValue({});

      await service.onConfirmDeleteAction(ctx);

      expect(mockExpensesService.deleteCategory).toHaveBeenCalledWith('cat-123', 12345n);
    });

    it('should confirm investment deletion', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['conf_del:inv:inv-123', 'inv', 'inv-123'];
      mockInvestmentsService.deleteOperation.mockResolvedValue({});

      await service.onConfirmDeleteAction(ctx);

      expect(mockInvestmentsService.deleteOperation).toHaveBeenCalledWith('inv-123', 12345n);
    });

    it('should handle cancel deletion', async () => {
      const ctx = mockContext('');
      await service.onCancelDeleteAction(ctx);
      expect(ctx.editMessageText).toHaveBeenCalledWith('Operação cancelada ❌');
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
      );
    });

    it('should update expense description', async () => {
      const ctx = mockContext('Nova descrição');
      (ctx as any).session = { editType: 'expense', editId: 'exp-1', editField: 'description' };
      await service.onMessage(ctx);
      expect(mockExpensesService.updateExpense).toHaveBeenCalledWith(12345n, 'exp-1', { description: 'Nova descrição' });
    });

    it('should update expense category', async () => {
      const ctx = mockContext('Mercado');
      (ctx as any).session = { editType: 'expense', editId: 'exp-1', editField: 'category' };
      await service.onMessage(ctx);
      expect(mockExpensesService.updateExpense).toHaveBeenCalledWith(12345n, 'exp-1', { categoryName: 'Mercado' });
    });

    it('should update category name', async () => {
      const ctx = mockContext('Novo Nome');
      (ctx as any).session = { editType: 'category', editId: 'cat-1' };
      await service.onMessage(ctx);
      expect(mockExpensesService.updateCategory).toHaveBeenCalledWith(12345n, 'cat-1', 'Novo Nome');
    });

    it('should update investment quantity', async () => {
      const ctx = mockContext('10.5');
      (ctx as any).session = { editType: 'investment', editId: 'inv-1', editField: 'quantity' };
      await service.onMessage(ctx);
      expect(mockInvestmentsService.updateOperation).toHaveBeenCalledWith(12345n, 'inv-1', { quantity: 10.5 });
    });

    it('should update investment price', async () => {
      const ctx = mockContext('30,50');
      (ctx as any).session = { editType: 'investment', editId: 'inv-1', editField: 'price' };
      await service.onMessage(ctx);
      expect(mockInvestmentsService.updateOperation).toHaveBeenCalledWith(12345n, 'inv-1', { unit_price: 30.5 });
    });
  });
});
