import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private readonly baseUrl = 'https://brapi.dev/api';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAssetPrice(ticker: string): Promise<number> {
    try {
      const token = this.configService.get<string>('BRAPI_TOKEN');
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/quote/${ticker}`, {
          params: { token },
        }),
      );

      if (!data.results || data.results.length === 0) {
        return 0;
      }

      return data.results[0].regularMarketPrice || 0;
    } catch (error) {
      this.logger.error(`Error fetching price for ${ticker}: ${error.message}`);
      return 0;
    }
  }
}
