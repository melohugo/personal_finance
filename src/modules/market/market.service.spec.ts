import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

describe('MarketService', () => {
  let service: MarketService;
  let config: ConfigService;

  // Mock para o HttpService que será adicionado
  const mockHttpService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
        if (key === 'BRAPI_TOKEN') return 'fake-token';
        return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketService,
        { provide: 'HttpService', useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MarketService>(MarketService);
    config = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAssetPrice', () => {
    it('should return the regularMarketPrice for a given ticker', async () => {
      const ticker = 'PETR4';
      const mockResponse = {
        data: {
          results: [
            {
              symbol: 'PETR4',
              regularMarketPrice: 35.5,
            },
          ],
        },
      };

      mockHttpService.get.mockReturnValue(of(mockResponse));

      const price = await service.getAssetPrice(ticker);

      expect(price).toBe(35.5);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        expect.stringContaining(`/quote/${ticker}`),
        expect.objectContaining({
          params: expect.objectContaining({ token: 'fake-token' }),
        })
      );
    });

    it('should return 0 or throw error if ticker not found', async () => {
        mockHttpService.get.mockReturnValue(of({ data: { results: [] } }));
        const price = await service.getAssetPrice('INVALID');
        expect(price).toBe(0);
    });
  });
});
