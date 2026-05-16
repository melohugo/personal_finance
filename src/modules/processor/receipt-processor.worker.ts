import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Markup, Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

@Processor('receipt_processing')
export class ReceiptProcessorWorker
  extends WorkerHost
  implements OnModuleDestroy
{
  private readonly logger = new Logger(ReceiptProcessorWorker.name);
  private redis: Redis;

  constructor(
    private readonly geminiService: GeminiService,
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
  ) {
    super();
    const redisUrl =
      this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });
  }

  async onModuleDestroy() {
    this.logger.log('Closing Redis connection in ReceiptProcessorWorker...');
    await this.redis.quit();
  }

  async process(
    job: Job<
      {
        imageUrl: string;
        telegramId: string;
        existingCategories: string[];
      },
      unknown,
      string
    >,
  ): Promise<{
    success: boolean;
    pendingId?: string;
    count?: number;
    reason?: string;
  }> {
    const { imageUrl, telegramId, existingCategories } = job.data;
    this.logger.log(`Processing receipt for user ${telegramId}`);

    try {
      const extractedList = await this.geminiService.extractExpenseFromImage(
        imageUrl,
        existingCategories,
      );

      if (!extractedList || extractedList.length === 0) {
        await this.bot.telegram.sendMessage(
          Number(telegramId),
          'ℹ️ Não consegui identificar nenhuma despesa clara nesta imagem. Por favor, tente uma foto mais nítida ou registre manualmente.',
        );
        return { success: false, reason: 'no_expenses_found' };
      }

      const pendingId = randomUUID();
      const redisKey = `pending_expense:${pendingId}`;

      // Store the whole list in redis
      await this.redis.set(
        redisKey,
        JSON.stringify({ expenses: extractedList, telegramId }),
        'EX',
        3600,
      );

      const totalAmount = extractedList.reduce(
        (sum, exp) => sum + exp.amount,
        0,
      );

      let message = `✅ *${extractedList.length} Despesas Identificadas!*\n\n`;

      extractedList.forEach((exp, index) => {
        const date = new Date(exp.date).toLocaleDateString('pt-BR', {
          timeZone: 'UTC',
        });
        message += `${index + 1}. 📅 ${date} | 💰 R$ ${exp.amount.toFixed(2)}\n`;
        message += `    📂 ${exp.category}${exp.isNewCategory ? ' ✨' : ''} | 📝 ${exp.description || 'N/A'}\n\n`;
      });

      message += `📊 *Total Geral: R$ ${totalAmount.toFixed(2)}*\n\n`;
      message += `Deseja registrar todos estes gastos de uma vez?`;

      await this.bot.telegram.sendMessage(Number(telegramId), message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback(
              'Confirmar Todos ✅',
              `conf_ai:${pendingId}`,
            ),
            Markup.button.callback('Descartar ❌', `canc_ai:${pendingId}`),
          ],
        ]),
      });

      return { success: true, pendingId, count: extractedList.length };
    } catch (error) {
      this.logger.error(`Error processing job ${job.id ?? 'unknown'}:`, error);
      await this.bot.telegram.sendMessage(
        Number(telegramId),
        '❌ Desculpe, ocorreu um erro ao processar sua imagem com IA. Por favor, tente novamente ou registre manualmente.',
      );
      throw error;
    }
  }
}
