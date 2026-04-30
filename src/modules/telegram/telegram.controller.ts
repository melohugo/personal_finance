import { Controller, Post, Body, Headers, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context } from 'telegraf';

@Controller('telegraf-webhook')
export class TelegramController {
  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
  ) {
    const expectedToken = this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET');

    // Validação de segurança opcional, mas recomendada
    if (expectedToken && secretToken !== expectedToken) {
      throw new ForbiddenException('Invalid secret token');
    }

    await this.bot.handleUpdate(update);
  }
}
