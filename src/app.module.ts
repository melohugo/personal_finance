import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { MarketModule } from './modules/market/market.module';
import { ProcessorModule } from './modules/processor/processor.module';
import { TelegramModule } from './modules/telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ExpensesModule,
    InvestmentsModule,
    MarketModule,
    ProcessorModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
