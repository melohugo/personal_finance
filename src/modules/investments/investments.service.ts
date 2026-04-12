import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { MarketService } from '../market/market.service';

export interface InvestmentAsset {
  ticker: string;
  position: number;
  pm: number;
  currentPrice: number;
  allocation: number;
  profit: number;
  profitPercentage: number;
}

export interface UserInvestments {
  assets: InvestmentAsset[];
  totalProfit: number;
  totalAllocation: number;
}

@Injectable()
export class InvestmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly marketService: MarketService,
  ) {}

  async listUserInvestments(telegramId: bigint): Promise<UserInvestments> {
    const operations = await this.prisma.assetOperation.findMany({
      where: { telegram_id: telegramId },
      include: { asset: true },
      orderBy: { date: 'asc' },
    });

    const assetData: Record<string, { 
      ticker: string; 
      qty: number; 
      totalCost: number; 
      totalQtyBought: number; 
    }> = {};

    for (const op of operations) {
      const ticker = op.asset.ticker;
      if (!assetData[ticker]) {
        assetData[ticker] = { ticker, qty: 0, totalCost: 0, totalQtyBought: 0 };
      }

      const qty = Number(op.quantity);
      const price = Number(op.unit_price);

      if (op.type === 'BUY') {
        assetData[ticker].qty += qty;
        assetData[ticker].totalCost += qty * price;
        assetData[ticker].totalQtyBought += qty;
      } else {
        assetData[ticker].qty -= qty;
      }
    }

    const assets: InvestmentAsset[] = [];
    let totalProfit = 0;
    let totalAllocation = 0;

    for (const ticker in assetData) {
      const data = assetData[ticker];
      if (data.qty <= 0) continue;

      const pm = data.totalCost / data.totalQtyBought;
      const currentPrice = await this.marketService.getAssetPrice(ticker);
      
      const allocation = data.qty * currentPrice;
      const profit = data.qty * (currentPrice - pm);
      const profitPercentage = ((currentPrice - pm) / pm) * 100;

      assets.push({
        ticker,
        position: data.qty,
        pm,
        currentPrice,
        allocation,
        profit,
        profitPercentage,
      });

      totalProfit += profit;
      totalAllocation += allocation;
    }

    return {
      assets,
      totalProfit,
      totalAllocation,
    };
  }
}
