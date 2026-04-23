import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { PrismaService } from '../../common/prisma.service';
import { MarketService } from '../market/market.service';
import { Prisma } from '@prisma/client';

describe('InvestmentsService', () => {
  let service: InvestmentsService;

  const mockPrismaService = {
    assetOperation: {
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockMarketService = {
    getAssetPrice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MarketService, useValue: mockMarketService },
      ],
    }).compile();

    service = module.get<InvestmentsService>(InvestmentsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listUserInvestments', () => {
    it('should calculate position and PM correctly (Scenario: Buy 10@20, Buy 10@30, Sell 5@40)', async () => {
      const telegramId = BigInt(123456);

      const operations = [
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Prisma.Decimal(10),
          unit_price: new Prisma.Decimal(20),
          type: 'BUY',
          date: new Date('2023-01-01'),
        },
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Prisma.Decimal(10),
          unit_price: new Prisma.Decimal(30),
          type: 'BUY',
          date: new Date('2023-01-02'),
        },
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Prisma.Decimal(5),
          unit_price: new Prisma.Decimal(40),
          type: 'SELL',
          date: new Date('2023-01-03'),
        },
      ];

      mockPrismaService.assetOperation.findMany.mockResolvedValue(operations);
      mockMarketService.getAssetPrice.mockResolvedValue(35);

      const result = await service.listUserInvestments(telegramId);

      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]).toMatchObject({
        ticker: 'PETR4',
        position: 15,
        pm: 25,
        currentPrice: 35,
        allocation: 525,
        profit: 150,
        profitPercentage: 40,
      });
      expect(result.totalProfit).toBe(150);
    });

    it('should handle multiple assets and overall profit calculation', async () => {
      const telegramId = BigInt(123456);

      const operations = [
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Prisma.Decimal(10),
          unit_price: new Prisma.Decimal(20),
          type: 'BUY',
          date: new Date('2023-01-01'),
        },
        {
          asset: { ticker: 'VALE3', type: 'STOCK' },
          quantity: new Prisma.Decimal(10),
          unit_price: new Prisma.Decimal(100),
          type: 'BUY',
          date: new Date('2023-01-01'),
        },
      ];

      mockPrismaService.assetOperation.findMany.mockResolvedValue(operations);
      mockMarketService.getAssetPrice.mockImplementation((ticker: string) => {
        if (ticker === 'PETR4') return Promise.resolve(25);
        if (ticker === 'VALE3') return Promise.resolve(90);
        return Promise.resolve(0);
      });

      const result = await service.listUserInvestments(telegramId);

      expect(result.assets).toHaveLength(2);
      expect(result.totalProfit).toBe(-50);
      expect(result.totalAllocation).toBe(1150);
    });

    it('should handle unavailable asset price correctly (currentPrice is null)', async () => {
      const telegramId = BigInt(123456);

      const operations = [
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Prisma.Decimal(10),
          unit_price: new Prisma.Decimal(20),
          type: 'BUY',
          date: new Date(),
        },
      ];

      mockPrismaService.assetOperation.findMany.mockResolvedValue(operations);
      mockMarketService.getAssetPrice.mockResolvedValue(null);

      const result = await service.listUserInvestments(telegramId);

      expect(result.assets[0]).toMatchObject({
        ticker: 'PETR4',
        currentPrice: null,
        profit: null,
        allocation: null,
      });
      expect(result.totalAllocation).toBe(0);
    });

    it('should reset PM after total sale (Scenario: Buy 10@20, Sell 10@40, Buy 5@30)', async () => {
      const telegramId = BigInt(123456);

      const operations = [
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Prisma.Decimal(10),
          unit_price: new Prisma.Decimal(20),
          type: 'BUY',
          date: new Date('2023-01-01'),
        },
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Prisma.Decimal(10),
          unit_price: new Prisma.Decimal(40),
          type: 'SELL',
          date: new Date('2023-01-02'),
        },
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Prisma.Decimal(5),
          unit_price: new Prisma.Decimal(30),
          type: 'BUY',
          date: new Date('2023-01-03'),
        },
      ];

      mockPrismaService.assetOperation.findMany.mockResolvedValue(operations);
      mockMarketService.getAssetPrice.mockResolvedValue(35);

      const result = await service.listUserInvestments(telegramId);

      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]).toMatchObject({
        ticker: 'PETR4',
        position: 5,
        pm: 30,
        profit: 25,
      });
    });
  });

  describe('listIndividualOperations', () => {
    const telegramId = 123456789n;

    it('should return a list of operations for the given period', async () => {
      const operations = [
        {
          id: 'op-1',
          asset: { ticker: 'PETR4' },
          quantity: new Prisma.Decimal(10),
          unit_price: new Prisma.Decimal(30),
          type: 'BUY',
          date: new Date(2024, 0, 10),
        },
      ];

      mockPrismaService.assetOperation.findMany.mockResolvedValue(operations);

      const result = await service.listIndividualOperations(telegramId, {
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 31),
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('op-1');
      expect(mockPrismaService.assetOperation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            telegram_id: telegramId,
          }),
        }),
      );
    });
  });

  describe('deleteOperation', () => {
    const telegramId = 123456789n;
    const operationId = 'op-123';

    it('should delete the operation if it belongs to the user', async () => {
      mockPrismaService.assetOperation.delete.mockResolvedValue({
        id: operationId,
      });

      await service.deleteOperation(operationId, telegramId);

      expect(mockPrismaService.assetOperation.delete).toHaveBeenCalledWith({
        where: {
          id: operationId,
          telegram_id: telegramId,
        },
      });
    });
  });

  describe('listIndividualOperations', () => {
    const telegramId = 123456789n;

    it('should return individual operations for the given range', async () => {
      const operations = [
        {
          id: '1',
          asset: { ticker: 'PETR4' },
          quantity: 10,
          date: new Date(),
        },
      ];
      mockPrismaService.assetOperation.findMany = jest
        .fn()
        .mockResolvedValue(operations);

      const result = await service.listIndividualOperations(telegramId, {
        start: new Date(),
        end: new Date(),
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('updateOperation', () => {
    const telegramId = 123456789n;
    const operationId = 'op-123';

    it('should update an asset operation', async () => {
      mockPrismaService.assetOperation.update = jest
        .fn()
        .mockResolvedValue({ id: operationId });

      await service.updateOperation(telegramId, operationId, {
        quantity: 15,
        unit_price: 25.5,
      });

      expect(mockPrismaService.assetOperation.update).toHaveBeenCalledWith({
        where: { id: operationId, telegram_id: telegramId },
        data: {
          quantity: 15,
          unit_price: 25.5,
        },
      });
    });

    it('should update operation date and type', async () => {
      mockPrismaService.assetOperation.update = jest
        .fn()
        .mockResolvedValue({ id: operationId });
      const newDate = new Date();

      await service.updateOperation(telegramId, operationId, {
        date: newDate,
        type: 'SELL',
      });

      expect(mockPrismaService.assetOperation.update).toHaveBeenCalledWith({
        where: { id: operationId, telegram_id: telegramId },
        data: {
          date: newDate,
          type: 'SELL',
        },
      });
    });
  });
});
