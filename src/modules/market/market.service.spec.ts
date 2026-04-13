import { Test, TestingModule } from '@nestjs/testing';
import { MarketService } from './market.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';

describe('MarketService', () => {
  let service: MarketService;
  let config: ConfigService;

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
        { provide: HttpService, useValue: mockHttpService },
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

    it('should return null if ticker results are empty', async () => {
        mockHttpService.get.mockReturnValue(of({ data: { results: [] } }));
        const price = await service.getAssetPrice('INVALID');
        expect(price).toBeNull();
    });

    it('should return null if an error occurs', async () => {
        mockHttpService.get.mockImplementation(() => {
            throw new Error('API Error');
        });
        const price = await service.getAssetPrice('PETR4');
        expect(price).toBeNull();
    });
  });
});
