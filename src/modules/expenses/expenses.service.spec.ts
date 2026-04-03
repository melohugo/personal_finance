import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../../common/prisma.service';

const mockPrisma = {
  category: {
    upsert: jest.fn(),
  },
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

    it('should create a category (if not exists) and then the expense', async () => {
      mockPrisma.category.upsert.mockResolvedValue({ id: 'cat-123', name: categoryName });
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-123', amount, category_id: 'cat-123' });

      const result = await service.createFromTelegram({
        telegramId,
        amount,
        categoryName,
      });

      expect(mockPrisma.category.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { name_telegram_id: { name: categoryName, telegram_id: telegramId } },
      }));
      expect(mockPrisma.expense.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          amount,
          telegram_id: telegramId,
          category_id: 'cat-123',
        }),
      }));
      expect(result).toBeDefined();
    });
  });
});
