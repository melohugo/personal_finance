import { Module } from '@nestjs/common';
import { InvestmentsService } from './investments.service';
import { PrismaModule } from '../../common/prisma.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [PrismaModule, MarketModule],
  providers: [InvestmentsService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
