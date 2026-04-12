import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { PrismaService } from '../../common/prisma.service';
import { MarketService } from '../market/market.service';
import { Decimal } from '@prisma/client/runtime/library';

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
          quantity: new Decimal(10),
          unit_price: new Decimal(20),
          type: 'BUY',
        },
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Decimal(10),
          unit_price: new Decimal(30),
          type: 'BUY',
        },
        {
          asset: { ticker: 'PETR4', type: 'STOCK' },
          quantity: new Decimal(5),
          unit_price: new Decimal(40),
          type: 'SELL',
        },
      ];

      mockPrismaService.assetOperation.findMany.mockResolvedValue(operations);
      mockMarketService.getAssetPrice.mockResolvedValue(35);

      const result = await service.listUserInvestments(telegramId);

      // PETR4 Calculation:
      // BUY 10 @ 20 = 200
      // BUY 10 @ 30 = 300
      // Total Qty Bought: 20, Total Cost: 500 => PM = 25
      // SELL 5 => Current Position: 15. PM remains 25.
      // Current Price: 35
      // Current Allocation: 15 * 35 = 525
      // Profit: 15 * (35 - 25) = 150
      // Profit %: (35-25)/25 * 100 = 40%
      
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
            quantity: new Decimal(10),
            unit_price: new Decimal(20),
            type: 'BUY',
          },
          {
            asset: { ticker: 'VALE3', type: 'STOCK' },
            quantity: new Decimal(10),
            unit_price: new Decimal(100),
            type: 'BUY',
          },
        ];
  
        mockPrismaService.assetOperation.findMany.mockResolvedValue(operations);
        mockMarketService.getAssetPrice.mockImplementation((ticker: string) => {
            if (ticker === 'PETR4') return Promise.resolve(25);
            if (ticker === 'VALE3') return Promise.resolve(90);
            return Promise.resolve(0);
        });
  
        const result = await service.listUserInvestments(telegramId);
  
        // PETR4: Pos 10, PM 20, Price 25 => Profit +50, Allocation 250
        // VALE3: Pos 10, PM 100, Price 90 => Profit -100, Allocation 900
        // Total Profit: -50
        // Total Allocation: 1150
        
        expect(result.assets).toHaveLength(2);
        expect(result.totalProfit).toBe(-50);
        expect(result.totalAllocation).toBe(1150);
      });

      it('should return empty list if user has no operations', async () => {
        const telegramId = BigInt(123456);
        mockPrismaService.assetOperation.findMany.mockResolvedValue([]);
        
        const result = await service.listUserInvestments(telegramId);
        
        expect(result.assets).toHaveLength(0);
        expect(result.totalProfit).toBe(0);
        expect(result.totalAllocation).toBe(0);
      });
  });
});
