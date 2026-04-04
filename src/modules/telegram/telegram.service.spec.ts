import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { ExpensesService } from '../expenses/expenses.service';
import { Context } from 'telegraf';

describe('TelegramService', () => {
  let service: TelegramService;
  let expensesService: ExpensesService;

  const mockExpensesService = {
    createFromTelegram: jest.fn(),
  };

  const mockContext = (text: string, telegramId: number = 12345) => ({
    message: { text },
    from: { id: telegramId },
    reply: jest.fn(),
  } as unknown as Context);

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramService,
        { provide: ExpensesService, useValue: mockExpensesService },
      ],
    }).compile();

    service = module.get<TelegramService>(TelegramService);
    expensesService = module.get<ExpensesService>(ExpensesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onGastoCommand', () => {
    it('should successfully process a valid /gasto command', async () => {
      const ctx = mockContext('/gasto 50.00 Mercado');
      mockExpensesService.createFromTelegram.mockResolvedValue({ id: '1', amount: 50, category: { name: 'Mercado' } });

      await service.onGastoCommand(ctx);

      expect(mockExpensesService.createFromTelegram).toHaveBeenCalledWith({
        telegramId: 12345n,
        amount: 50,
        categoryName: 'Mercado',
      });
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Gasto de R$ 50 registrado em Mercado! ✅')
      );
    });

    it('should reply with error message for invalid format', async () => {
      const ctx = mockContext('/gasto apenas_texto');

      await service.onGastoCommand(ctx);

      expect(expensesService.createFromTelegram).not.toHaveBeenCalled();
      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Use o formato: /gasto <valor> <categoria>')
      );
    });

    it('should handle errors when ExpensesService fails (e.g. user not found)', async () => {
      const ctx = mockContext('/gasto 10 Teste');
      mockExpensesService.createFromTelegram.mockRejectedValue(new Error('Record to connect not found'));

      await service.onGastoCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao registrar gasto. Você já iniciou o bot com /start?')
      );
    });

    it('should handle generic errors gracefully', async () => {
      const ctx = mockContext('/gasto 10 Teste');
      mockExpensesService.createFromTelegram.mockRejectedValue(new Error('Database down'));

      await service.onGastoCommand(ctx);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Ocorreu um erro inesperado. Tente novamente mais tarde.')
      );
    });
  });
});

// Helper for expect.stringContaining
function stringContaining(val: string) {
  return expect.stringContaining(val);
}
