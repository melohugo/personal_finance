import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegramService } from './telegram.service';
import { ExpensesModule } from '../expenses/expenses.module';
import { UsersModule } from '../users/users.module';
import { InvestmentsModule } from '../investments/investments.module';

@Module({
  imports: [ConfigModule, ExpensesModule, UsersModule, InvestmentsModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
