import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MarketService } from './market.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule {}
