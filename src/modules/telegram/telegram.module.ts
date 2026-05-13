import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { ExpensesModule } from '../expenses/expenses.module';
import { UsersModule } from '../users/users.module';
import { InvestmentsModule } from '../investments/investments.module';
import { ProcessorModule } from '../processor/processor.module';

@Module({
  imports: [
    ConfigModule,
    ExpensesModule,
    UsersModule,
    InvestmentsModule,
    ProcessorModule,
  ],
  providers: [TelegramService],
  controllers: [TelegramController],
  exports: [TelegramService],
})
export class TelegramModule {}
