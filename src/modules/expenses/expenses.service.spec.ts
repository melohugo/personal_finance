/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../../common/prisma.service';

const mockPrisma = {
  expense: {
    create: jest.fn(),
  },
};

describe('ExpensesService', () => {
  let service: ExpensesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFromTelegram', () => {
    const telegramId = 123456789n;
    const amount = 50.5;
    const categoryName = 'Alimentação';

    it('should create an expense with connectOrCreate for category', async () => {
      (mockPrisma.expense.create as jest.Mock).mockResolvedValue({
        id: 'exp-123',
        amount,
        category_id: 'cat-123',
      });

      const result = await service.createFromTelegram({
        telegramId,
        amount,
        categoryName,
      });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount,
            category: {
              connectOrCreate: {
                where: {
                  name_telegram_id: {
                    name: categoryName,
                    telegram_id: telegramId,
                  },
                },
                create: {
                  name: categoryName,
                  telegram_id: telegramId,
                },
              },
            },
          }),
        }),
      );
      expect(result).toBeDefined();
    });


    it('should throw an error if amount is zero', async () => {
      await expect(
        service.createFromTelegram({
          telegramId,
          amount: 0,
          categoryName,
        }),
      ).rejects.toThrow('Amount must be greater than zero');
    });

    it('should throw an error if amount is negative', async () => {
      await expect(
        service.createFromTelegram({
          telegramId,
          amount: -10,
          categoryName,
        }),
      ).rejects.toThrow('Amount must be greater than zero');
    });
  });
});
