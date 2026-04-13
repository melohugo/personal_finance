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
        // Se a posição zerou, resetamos o custo para um novo PM no futuro
        if (assetData[ticker].qty <= 0) {
          assetData[ticker].totalCost = 0;
          assetData[ticker].totalQtyBought = 0;
          assetData[ticker].qty = 0;
        }
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
      
      const allocation = currentPrice !== null ? data.qty * currentPrice : null;
      const profit = currentPrice !== null ? data.qty * (currentPrice - pm) : null;
      const profitPercentage = currentPrice !== null ? ((currentPrice - pm) / pm) * 100 : null;

      assets.push({
        ticker,
        position: data.qty,
        pm,
        currentPrice,
        allocation,
        profit,
        profitPercentage,
      });

      if (profit !== null) totalProfit += profit;
      if (allocation !== null) totalAllocation += allocation;
    }

    return {
      assets,
      totalProfit,
      totalAllocation,
    };
  }
}
