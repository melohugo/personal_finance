import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { MarketModule } from './modules/market/market.module';
import { ProcessorModule } from './modules/processor/processor.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { PrismaModule } from './common/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TelegrafModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const token = configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
        const baseUrl = configService.get<string>('BASE_URL');

        return {
          token,
          middlewares: [session()],
          launchOptions: baseUrl
            ? {
                webhook: {
                  domain: baseUrl,
                  hookPath: '/telegraf',
                },
              }
            : undefined,
        };
      },
    }),
    PrismaModule,
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
