/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../../common/prisma.service';

const mockPrisma = {
  expense: {
    create: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
  category: {
    findMany: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
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
    const categoryNameRaw = 'alimentação';
    const categoryNameNormalized = 'Alimentacao';

    it('should create an expense with normalized category and current date if none provided', async () => {
      mockPrisma.expense.create.mockResolvedValue({
        id: 'exp-123',
        amount,
        category_id: 'cat-123',
      });

      const result = await service.createFromTelegram({
        telegramId,
        amount,
        categoryName: categoryNameRaw,
      });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount,
            date: expect.any(Date),
            category: {
              connectOrCreate: {
                where: {
                  name_telegram_id: {
                    name: categoryNameNormalized,
                    telegram_id: telegramId,
                  },
                },
                create: {
                  name: categoryNameNormalized,
                  telegram_id: telegramId,
                },
              },
            },
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('should create an expense with specific date if provided', async () => {
      const customDate = new Date(2026, 3, 20);
      mockPrisma.expense.create.mockResolvedValue({ id: 'exp-123' });

      await service.createFromTelegram({
        telegramId,
        amount,
        categoryName: 'Mercado',
        date: customDate,
      });

      expect(mockPrisma.expense.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date: customDate,
          }),
        }),
      );
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

  describe('listExpenses', () => {
    const telegramId = 123456789n;

    it('should return empty list when no expenses found', async () => {
      mockPrisma.expense.findMany.mockResolvedValue([]);

      const result = await service.listExpenses({
        telegramId,
        range: {
          start: new Date(2024, 0, 1),
          end: new Date(2024, 0, 31),
        },
      });

      expect(result.months).toEqual([]);
    });

    it('should group expenses by month and calculate totals with realistic categories', async () => {
      const expenses = [
        {
          amount: 100,
          date: new Date(2024, 0, 10),
          category: { name: 'Alimentação' },
        },
        {
          amount: 50,
          date: new Date(2024, 0, 20),
          category: { name: 'Academia' },
        },
      ];

      mockPrisma.expense.findMany.mockResolvedValue(expenses);

      const result = await service.listExpenses({
        telegramId,
        range: {
          start: new Date(2024, 0, 1),
          end: new Date(2024, 0, 31),
        },
      });

      expect(result.months).toHaveLength(1);
      expect(result.months[0].total).toBe(150);
      expect(result.months[0].byCategory).toHaveLength(2);
      const food = result.months[0].byCategory.find(
        (c) => c.name === 'Alimentação',
      );
      expect(food?.amount).toBe(100);
    });

    it('should calculate percentages comparing with previous month', async () => {
      const expenses = [
        // Janeiro
        {
          amount: 200,
          date: new Date(2024, 0, 10),
          category: { name: 'Alimentação' },
        },
        {
          amount: 100,
          date: new Date(2024, 0, 15),
          category: { name: 'Transporte' },
        },
        // Fevereiro
        {
          amount: 300,
          date: new Date(2024, 1, 10),
          category: { name: 'Alimentação' },
        },
        {
          amount: 50,
          date: new Date(2024, 1, 15),
          category: { name: 'Transporte' },
        },
      ];

      mockPrisma.expense.findMany.mockResolvedValue(expenses);

      const result = await service.listExpenses({
        telegramId,
        range: {
          start: new Date(2024, 0, 1),
          end: new Date(2024, 1, 29),
        },
      });

      const jan = result.months.find((m) => m.month === 0);
      const fev = result.months.find((m) => m.month === 1);

      expect(jan?.total).toBe(300);
      expect(fev?.total).toBe(350);

      // Variação total: ((350 - 300) / 300) * 100 = 16.66...%
      expect(fev?.diffTotal).toBeCloseTo(16.67, 1);

      // Variação Alimentação: ((300 - 200) / 200) * 100 = 50%
      const foodFev = fev?.byCategory.find((c) => c.name === 'Alimentação');
      expect(foodFev?.diffPrevMonth).toBe(50);

      // Variação Transporte: ((50 - 100) / 100) * 100 = -50%
      const transportFev = fev?.byCategory.find((c) => c.name === 'Transporte');
      expect(transportFev?.diffPrevMonth).toBe(-50);
    });
  });

  describe('listCategories', () => {
    const telegramId = 123456789n;

    it('should return categories for the user', async () => {
      const categories = [
        { id: '1', name: 'Academia', telegram_id: telegramId },
        { id: '2', name: 'Alimentação', telegram_id: telegramId },
      ];

      mockPrisma.category.findMany.mockResolvedValue(categories);

      const result = await service.listCategories(telegramId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Academia');
      expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
        where: { telegram_id: telegramId },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('listIndividualExpenses', () => {
    const telegramId = 123456789n;

    it('should return a flat list of expenses', async () => {
      const expenses = [
        {
          id: 'exp-1',
          amount: 100,
          date: new Date(2024, 0, 10),
          category: { name: 'Alimentação' },
        },
      ];

      mockPrisma.expense.findMany.mockResolvedValue(expenses);

      const result = await service.listIndividualExpenses({
        telegramId,
        range: {
          start: new Date(2024, 0, 1),
          end: new Date(2024, 0, 31),
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('exp-1');
    });
  });

  describe('updateExpense', () => {
    const telegramId = 123456789n;
    const expenseId = 'exp-123';

    it('should update an expense if it belongs to the user', async () => {
      mockPrisma.expense.update = jest.fn().mockResolvedValue({ id: expenseId });

      await service.updateExpense(telegramId, expenseId, {
        amount: 150.0,
        description: 'Updated description',
      });

      expect(mockPrisma.expense.update).toHaveBeenCalledWith({
        where: { id: expenseId, telegram_id: telegramId },
        data: {
          amount: 150.0,
          description: 'Updated description',
        },
      });
    });

    it('should update expense category using connectOrCreate', async () => {
      mockPrisma.expense.update = jest.fn().mockResolvedValue({ id: expenseId });

      await service.updateExpense(telegramId, expenseId, {
        categoryName: 'Novo Nome',
      });

      expect(mockPrisma.expense.update).toHaveBeenCalledWith({
        where: { id: expenseId, telegram_id: telegramId },
        data: {
          category: {
            connectOrCreate: {
              where: {
                name_telegram_id: {
                  name: 'Novo Nome',
                  telegram_id: telegramId,
                },
              },
              create: {
                name: 'Novo Nome',
                telegram_id: telegramId,
              },
            },
          },
        },
      });
    });
  });

  describe('deleteExpense', () => {
    const telegramId = 123456789n;
    const expenseId = 'exp-123';

    it('should delete the expense if it belongs to the user', async () => {
      mockPrisma.expense.delete.mockResolvedValue({ id: expenseId });

      await service.deleteExpense(expenseId, telegramId);

      expect(mockPrisma.expense.delete).toHaveBeenCalledWith({
        where: {
          id: expenseId,
          telegram_id: telegramId,
        },
      });
    });
  });

  describe('updateCategory', () => {
    const telegramId = 123456789n;
    const categoryId = 'cat-123';

    it('should rename a category', async () => {
      mockPrisma.category.update = jest.fn().mockResolvedValue({ id: categoryId });

      await service.updateCategory(telegramId, categoryId, 'Supermercado');

      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: categoryId, telegram_id: telegramId },
        data: { name: 'Supermercado' },
      });
    });
  });

  describe('deleteCategory', () => {
    const telegramId = 123456789n;
    const categoryId = 'cat-123';

    it('should delete the category if it belongs to the user', async () => {
      mockPrisma.category.delete.mockResolvedValue({ id: categoryId });

      await service.deleteCategory(categoryId, telegramId);

      expect(mockPrisma.category.delete).toHaveBeenCalledWith({
        where: {
          id: categoryId,
          telegram_id: telegramId,
        },
      });
    });
  });
});
