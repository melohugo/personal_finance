/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ReceiptProcessorWorker } from './receipt-processor.worker';
import { GeminiService } from './gemini.service';
import { ConfigService } from '@nestjs/config';
import { getBotToken } from 'nestjs-telegraf';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

jest.mock('ioredis');
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(),
}));

describe('ReceiptProcessorWorker', () => {
  let worker: ReceiptProcessorWorker;
  let geminiService: GeminiService;
  let bot: any;
  let redisMock: jest.Mocked<Redis>;

  const mockGeminiService = {
    extractExpenseFromImage: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  };

  const mockBot = {
    telegram: {
      sendMessage: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptProcessorWorker,
        { provide: GeminiService, useValue: mockGeminiService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getBotToken(), useValue: mockBot },
      ],
    }).compile();

    worker = module.get<ReceiptProcessorWorker>(ReceiptProcessorWorker);
    geminiService = module.get<GeminiService>(GeminiService);
    bot = module.get(getBotToken());
    redisMock = (worker as any).redis;
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('process', () => {
    const jobData = {
      imageUrl: 'http://example.com/image.jpg',
      telegramId: '123456',
      existingCategories: ['Food', 'Transport'],
    };
    const job = { data: jobData, id: '1' } as Job;

    it('should process receipt and send confirmation message', async () => {
      const extractedExpenses = [
        {
          amount: 50,
          category: 'Food',
          date: '2026-05-10',
          description: 'Lunch',
          isNewCategory: false,
        },
        {
          amount: 20,
          category: 'Transport',
          date: '2026-05-10',
          description: 'Uber',
          isNewCategory: false,
        },
      ];
      mockGeminiService.extractExpenseFromImage.mockResolvedValue(
        extractedExpenses,
      );
      (randomUUID as jest.Mock).mockReturnValue('uuid-123');

      const result = await worker.process(job);

      expect(geminiService.extractExpenseFromImage).toHaveBeenCalledWith(
        jobData.imageUrl,
        jobData.existingCategories,
      );

      // Verify Redis storage
      expect(redisMock.set).toHaveBeenCalledWith(
        'pending_expense:uuid-123',
        JSON.stringify({ expenses: extractedExpenses, telegramId: '123456' }),
        'EX',
        3600,
      );

      // Verify Telegram message
      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('2 Despesas Identificadas'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ callback_data: 'conf_ai:uuid-123' }),
                expect.objectContaining({ callback_data: 'canc_ai:uuid-123' }),
              ]),
            ]),
          }),
        }),
      );

      expect(result).toEqual({
        success: true,
        pendingId: 'uuid-123',
        count: 2,
      });
    });

    it('should handle no expenses found', async () => {
      mockGeminiService.extractExpenseFromImage.mockResolvedValue([]);

      const result = await worker.process(job);

      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('Não consegui identificar nenhuma despesa'),
      );
      expect(result).toEqual({ success: false, reason: 'no_expenses_found' });
      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('should notify user and throw on error', async () => {
      const error = new Error('Gemini failed');
      mockGeminiService.extractExpenseFromImage.mockRejectedValue(error);

      await expect(worker.process(job)).rejects.toThrow('Gemini failed');

      expect(bot.telegram.sendMessage).toHaveBeenCalledWith(
        123456,
        expect.stringContaining('erro ao processar sua imagem com IA'),
      );
    });
  });
});
