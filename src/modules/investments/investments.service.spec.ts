import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { PrismaService } from '../../common/prisma.service';
import { MarketService } from '../market/market.service';
import { Prisma } from '@prisma/client';

describe('InvestmentsService', () => {
  let service: InvestmentsService;
  let prisma: PrismaService;
  let market: MarketService;

  const mockPrismaService = {
    assetOperation: {
      findMany: jest.fn(),
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
    prisma = module.get<PrismaService>(PrismaService);
    market = module.get<MarketService>(MarketService);
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
        mockMarketService.getAssetPrice.mockResolvedValue(null); // API falhou ou não encontrou
  
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

        // Explicação:
        // 1. Compra 10 @ 20 (PM=20, Qtd=10)
        // 2. Vende 10 @ 40 (Qtd=0) -> PM deve resetar.
        // 3. Compra 5 @ 30 (PM=30, Qtd=5) -> Se não resetar, o PM antigo (20) poluiria o novo.
        
        expect(result.assets).toHaveLength(1);
        expect(result.assets[0]).toMatchObject({
          ticker: 'PETR4',
          position: 5,
          pm: 30,
          profit: 25, // 5 * (35 - 30)
        });
      });
  });
});
