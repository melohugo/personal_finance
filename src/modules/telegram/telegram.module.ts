import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { TelegramService } from './telegram.service';
import { ExpensesModule } from '../expenses/expenses.module';
import * as Agent from 'https';

@Module({
  imports: [
    ExpensesModule,
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        token: configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN'),
        options: {
          handlerTimeout: 10_000,
        },
        // Configuração avançada da API do Telegram
        configTelegram: {
          agent: new Agent.Agent({ family: 4, keepAlive: true }),
        },
        launchOptions: {
          allowedUpdates: ['message', 'callback_query'],
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [TelegramService],
})
export class TelegramModule {}
