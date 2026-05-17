/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { ExpensesService } from '../expenses/expenses.service';
import { UsersService } from '../users/users.service';
import { InvestmentsService } from '../investments/investments.service';
import { Context } from 'telegraf';
import { getBotToken } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';

jest.mock('ioredis');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(),
}));

describe('TelegramService', () => {
  let service: TelegramService;

  const mockBot = {
    telegram: {
      setWebhook: jest.fn().mockResolvedValue(true),
      getWebhookInfo: jest.fn().mockResolvedValue({
        url: 'https://test.com',
        pending_update_count: 0,
      }),
      getFileLink: jest
        .fn()
        .mockResolvedValue(new URL('https://api.telegram.org/file/bot/123')),
      sendMessage: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'BASE_URL') return 'https://test.com';
      if (key === 'TELEGRAM_WEBHOOK_SECRET') return 'secret';
      return undefined;
    }),
  };

  const mockExpensesService = {
    createFromTelegram: jest.fn(),
    listExpenses: jest.fn(),
    listCategories: jest.fn(),
    listIndividualExpenses: jest.fn(),
    deleteExpense: jest.fn(),
    deleteCategory: jest.fn(),
    updateExpense: jest.fn(),
    updateCategory: jest.fn(),
    findDuplicate: jest.fn(),
  };

  const mockUsersService = {
    getOrCreateUser: jest.fn(),
  };

  const mockInvestmentsService = {
    listUserInvestments: jest.fn(),
    listIndividualOperations: jest.fn(),
    updateOperation: jest.fn(),
    deleteOperation: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: '1' }),
  };

  const mockContext = (
    text: string,
    telegramId = 12345,
    match: string[] = [],
  ) =>
    ({
      message: { text, photo: [{ file_id: 'photo_id' }] },
      from: { id: telegramId },
      callbackQuery: { data: match[0] || '' },
      reply: jest.fn(),
      replyWithMarkdown: jest.fn(),
      editMessageText: jest.fn(),
      answerCbQuery: jest.fn(),
      match,
      session: {},
    }) as unknown as Context;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: ExpensesService, useValue: mockExpensesService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: InvestmentsService, useValue: mockInvestmentsService },
        { provide: getBotToken(), useValue: mockBot },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken('receipt_processing'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('start', () => {
    it('should welcome the user', async () => {
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

      expect(mockBot.telegram.getWebhookInfo).toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Estou online e operacional!'),
      );
    });
  });

  describe('onGastoCommand', () => {
    it('should register a simple gasto correctly when no duplicate is found', async () => {
      const ctx = mockContext('/gasto 50.0 Alimentação');
      mockExpensesService.findDuplicate.mockResolvedValue(null);
      mockExpensesService.createFromTelegram.mockResolvedValue({});

      await service.onGastoCommand(ctx);

      expect(mockExpensesService.findDuplicate).toHaveBeenCalled();
      expect(mockExpensesService.createFromTelegram).toHaveBeenCalledWith({
        telegramId: 12345n,
        amount: 50,
        categoryName: 'Alimentacao',
        date: undefined,
      });
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Gasto de R$ 50.00 registrado'),
      );
    });

    it('should ask for confirmation if a duplicate is found', async () => {
      const ctx = mockContext('/gasto 50.0 Alimentação');
      mockExpensesService.findDuplicate.mockResolvedValue({
        id: 'existing-exp',
      });
      (randomUUID as jest.Mock).mockReturnValue('uuid-dup-123');

      await service.onGastoCommand(ctx);

      expect(mockExpensesService.createFromTelegram).not.toHaveBeenCalled();
      expect(service['redis'].set).toHaveBeenCalledWith(
        'dup_exp:uuid-dup-123',
        expect.stringContaining('"amount":50'),
        'EX',
        3600,
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('já parece estar registrado. Deseja ignorar?'),
        expect.any(Object),
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

      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('PETR4'),
      );
    });

    it('should list expenses when "/listar gastos" is called', async () => {
      const ctx = mockContext('/listar gastos');
      mockExpensesService.listExpenses.mockResolvedValue({
        months: [
          {
            month: 4,
            year: 2026,
            total: 1500,
            diffTotal: 10,
            byCategory: [{ name: 'Lazer', amount: 500, diffPrevMonth: 5 }],
          },
        ],
        total: 1500,
      });

      await service.onListarCommand(ctx);

      expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
        expect.stringContaining('maio/2026'),
      );
    });
  });

  describe('help', () => {
    it('should reply with help message', async () => {
      const ctx = mockContext('/help');
      await service.help(ctx);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Comandos disponíveis'),
      );
    });
  });

  describe('onDeletarCommand', () => {
    it('should show items for deletion when type provided', async () => {
      const ctx = mockContext('/deletar gastos maio');
      mockExpensesService.listIndividualExpenses.mockResolvedValue([
        {
          id: '1',
          amount: 100,
          category: { name: 'Comida' },
          date: new Date(),
        },
      ]);

      await service.onDeletarCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Escolha o item para deletar'),
        expect.any(Object),
      );
    });
  });

  describe('onEditarCommand', () => {
    it('should show items for editing when period/type provided', async () => {
      const ctx = mockContext('/editar gastos maio');
      mockExpensesService.listIndividualExpenses.mockResolvedValue([
        {
          id: '1',
          amount: 100,
          category: { name: 'Comida' },
          date: new Date(),
        },
      ]);

      await service.onEditarCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Escolha um gasto para editar'),
        expect.any(Object),
      );
    });
  });

  describe('Delete Action Flow', () => {
    it('should ask for confirmation on onDeleteAction', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['del:exp:123', 'exp', '123'];
      (ctx.callbackQuery as any).message = { text: 'R$ 50.00' };

      await service.onDeleteAction(ctx as any);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('Deseja realmente deletar'),
        expect.any(Object),
      );
    });

    it('should confirm deletion on onConfirmDeleteAction', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['conf_del:exp:123', 'exp', '123'];

      await service.onConfirmDeleteAction(ctx as any);

      expect(mockExpensesService.deleteExpense).toHaveBeenCalled();
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        'Excluído com sucesso ✅',
      );
    });

    it('should cancel deletion on onCancelDeleteAction', async () => {
      const ctx = mockContext('');

      await service.onCancelDeleteAction(ctx as any);

      expect(ctx.editMessageText).toHaveBeenCalledWith('Operação cancelada ❌');
    });
  });

  describe('Edit Action Flow', () => {
    it('should store edit state in session when expense is selected', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['edit_exp_123', '123'];

      await service.onEditExpense(ctx as any);

      expect((ctx as any).session.editType).toBe('expense');
      expect((ctx as any).session.editId).toBe('123');
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('O que deseja alterar'),
        expect.any(Object),
      );
    });

    it('should prompt for category name when category is selected', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['edit_cat_456', '456'];

      await service.onEditCategory(ctx as any);

      expect((ctx as any).session.editType).toBe('category');
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Envie o novo nome'),
      );
    });

    it('should prompt for investment field when investment is selected', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['edit_inv_789', '789'];

      await service.onEditInvestment(ctx as any);

      expect((ctx as any).session.editType).toBe('investment');
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('O que deseja alterar nesta operação'),
        expect.any(Object),
      );
    });

    it('should prompt for specific field on onEditField', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['edit_field_amount', 'amount'];

      await service.onEditField(ctx as any);

      expect((ctx as any).session.editField).toBe('amount');
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Envie o novo valor'),
      );
    });
  });

  describe('AI Edit Action Flow', () => {
    it('should show field selection menu when an AI item is selected for editing', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['edit_ai:pending-123:0', 'pending-123', '0'];

      await service.onEditAiExpense(ctx as any);

      expect((ctx as any).session.editType).toBe('ai_pending');
      expect((ctx as any).session.editId).toBe('pending-123');
      expect((ctx as any).session.editItemIndex).toBe(0);
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining(
          'O que deseja alterar neste item extraído pela IA?',
        ),
        expect.any(Object),
      );
    });

    it('should store field selection in session on onEditAiField', async () => {
      const ctx = mockContext('');
      (ctx as any).match = [
        'edit_ai_field:pending-123:0:amount',
        'pending-123',
        '0',
        'amount',
      ];

      await service.onEditAiField(ctx as any);

      expect((ctx as any).session.editType).toBe('ai_pending');
      expect((ctx as any).session.editId).toBe('pending-123');
      expect((ctx as any).session.editItemIndex).toBe(0);
      expect((ctx as any).session.editField).toBe('amount');
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Envie o novo valor'),
      );
    });
  });

  describe('onPhoto', () => {
    it('should add image processing task to the queue', async () => {
      const ctx = mockContext('');
      (ctx.message as any).photo = [{ file_id: 'photo_id' }];
      mockExpensesService.listCategories.mockResolvedValue([
        { name: 'Comida' },
      ]);

      await service.onPhoto(ctx);

      expect(mockBot.telegram.getFileLink).toHaveBeenCalledWith('photo_id');
      expect(mockQueue.add).toHaveBeenCalledWith('process_receipt', {
        fileUrl: 'https://api.telegram.org/file/bot/123',
        fileMimeType: 'image/jpeg',
        telegramId: '12345',
        existingCategories: ['Comida'],
      });
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Imagem recebida!'),
      );
    });
  });

  describe('onDocument', () => {
    it('should add PDF document task to the queue', async () => {
      const ctx = mockContext('');
      (ctx.message as any).document = {
        file_id: 'pdf_id',
        mime_type: 'application/pdf',
      };
      mockExpensesService.listCategories.mockResolvedValue([]);

      await service.onDocument(ctx);

      expect(mockBot.telegram.getFileLink).toHaveBeenCalledWith('pdf_id');
      expect(mockQueue.add).toHaveBeenCalledWith('process_receipt', {
        fileUrl: 'https://api.telegram.org/file/bot/123',
        fileMimeType: 'application/pdf',
        telegramId: '12345',
        existingCategories: [],
      });
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('PDF recebido!'),
      );
    });
  });

  describe('onConfirmAI', () => {
    it('should register multiple expenses and handle duplicates', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['conf_ai:pending-123', 'pending-123'];
      (ctx as any).callbackQuery = { data: 'conf_ai:pending-123' };

      const mockData = {
        telegramId: '12345',
        expenses: [
          {
            amount: 100,
            category: 'Saúde',
            date: '2026-05-15',
            description: 'Farmácia',
          },
          {
            amount: 50,
            category: 'Alimentação',
            date: '2026-05-16',
            description: 'Mercado',
          },
        ],
      };

      // 1. First expense is new, second is duplicate
      mockExpensesService.findDuplicate
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing' });

      mockExpensesService.createFromTelegram.mockResolvedValue({});
      service['redis'].get = jest
        .fn()
        .mockResolvedValue(JSON.stringify(mockData));
      service['redis'].del = jest.fn().mockResolvedValue(1);
      (randomUUID as jest.Mock).mockReturnValue('uuid-dup-ai');

      await service.onConfirmAI(ctx as any);

      // Verify first was saved
      expect(mockExpensesService.createFromTelegram).toHaveBeenCalledTimes(1);
      expect(mockExpensesService.createFromTelegram).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          categoryName: 'Saúde',
          description: 'Farmácia',
        }),
      );

      // Verify summary updated
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('1 gastos registrados com sucesso via IA!'),
      );

      // Verify duplicate prompt sent for second
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledWith(
        12345,
        expect.stringContaining(
          'Mercado de R$ 50.00 já parece estar registrado',
        ),
        expect.any(Object),
      );
    });

    it('should handle expired pending expense', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['conf_ai:expired', 'expired'];
      (ctx as any).callbackQuery = { data: 'conf_ai:expired' };
      service['redis'].get = jest.fn().mockResolvedValue(null);

      await service.onConfirmAI(ctx as any);

      expect(ctx.editMessageText).toHaveBeenCalledWith(
        expect.stringContaining('pendência expirou'),
      );
    });
  });

  describe('onCancelAI', () => {
    it('should discard pending registration and delete from redis', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['canc_ai:pending-123', 'pending-123'];
      (ctx as any).callbackQuery = { data: 'canc_ai:pending-123' };
      service['redis'].del = jest.fn().mockResolvedValue(1);

      await service.onCancelAI(ctx as any);

      expect(service['redis'].del).toHaveBeenCalledWith(
        'pending_expense:pending-123',
      );
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        'Registro descartado ❌',
      );
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });
  });

  describe('Duplicate Action Handlers', () => {
    it('should ignore duplicate on dup_ign', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['dup_ign:uuid123', 'uuid123'];
      (ctx as any).callbackQuery = { data: 'dup_ign:uuid123' };
      service['redis'].del = jest.fn().mockResolvedValue(1);

      await service.onDuplicateIgnore(ctx as any);

      expect(service['redis'].del).toHaveBeenCalledWith('dup_exp:uuid123');
      expect(ctx.editMessageText).toHaveBeenCalledWith('Gasto ignorado ❌');
      expect(ctx.answerCbQuery).toHaveBeenCalled();
    });

    it('should save duplicate on dup_sav', async () => {
      const ctx = mockContext('');
      (ctx as any).match = ['dup_sav:uuid123', 'uuid123'];
      (ctx as any).callbackQuery = { data: 'dup_sav:uuid123' };
      const mockData = {
        telegramId: '12345',
        amount: 50,
        categoryName: 'Alimentação',
        date: '2026-05-15T00:00:00.000Z',
        description: 'Mercado',
      };

      service['redis'].get = jest
        .fn()
        .mockResolvedValue(JSON.stringify(mockData));
      service['redis'].del = jest.fn().mockResolvedValue(1);
      mockExpensesService.createFromTelegram.mockResolvedValue({});

      await service.onDuplicateSave(ctx as any);

      expect(mockExpensesService.createFromTelegram).toHaveBeenCalledWith({
        telegramId: 12345n,
        amount: 50,
        categoryName: 'Alimentação',
        date: new Date('2026-05-15T00:00:00.000Z'),
        description: 'Mercado',
      });
      expect(ctx.editMessageText).toHaveBeenCalledWith(
        'Gasto registrado com sucesso ✅',
      );
      expect(service['redis'].del).toHaveBeenCalledWith('dup_exp:uuid123');
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

      await service.onMessage(ctx as any);

      expect(mockExpensesService.updateExpense).toHaveBeenCalledWith(
        12345n,
        'exp-123',
        { amount: 150.5 },
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Gasto atualizado com sucesso! ✅'),
      );
    });

    it('should update ai pending expense in Redis and send updated message', async () => {
      const ctx = mockContext('75.00');
      (ctx as any).session = {
        editType: 'ai_pending',
        editId: 'pending-123',
        editItemIndex: 0,
        editField: 'amount',
      };

      const mockData = {
        telegramId: '12345',
        expenses: [
          {
            amount: 100,
            category: 'Saúde',
            date: '2026-05-15',
            description: 'Farmácia',
            isNewCategory: false,
          },
        ],
      };

      service['redis'].get = jest
        .fn()
        .mockResolvedValue(JSON.stringify(mockData));
      service['redis'].set = jest.fn().mockResolvedValue('OK');

      await service.onMessage(ctx as any);

      // Verify Redis updated
      const expectedUpdatedData = {
        ...mockData,
        expenses: [
          {
            ...mockData.expenses[0],
            amount: 75,
          },
        ],
      };
      expect(service['redis'].set).toHaveBeenCalledWith(
        'pending_expense:pending-123',
        JSON.stringify(expectedUpdatedData),
        'EX',
        3600,
      );

      // Verify updated message sent
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('R$ 75.00'),
        expect.any(Object),
      );

      // Session cleared
      expect((ctx as any).session.editId).toBeUndefined();
    });
  });
});
