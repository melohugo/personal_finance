import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { GeminiService } from './gemini.service';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { buildAiConfirmationMessage } from '../telegram/telegram-parser.utils';

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
        fileUrl: string;
        fileMimeType: string;
        telegramId: string;
        existingCategories: string[];
        recentExpenses: any[];
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
    const {
      fileUrl,
      fileMimeType,
      telegramId,
      existingCategories,
      recentExpenses,
    } = job.data;
    this.logger.log(
      `Processing receipt file for user ${telegramId} (${fileMimeType})`,
    );

    try {
      const extractedList = await this.geminiService.extractExpenseFromFile(
        fileUrl,
        fileMimeType,
        existingCategories,
        recentExpenses,
      );

      if (!extractedList || extractedList.length === 0) {
        await this.bot.telegram.sendMessage(
          Number(telegramId),
          'ℹ️ Não consegui identificar nenhuma despesa clara neste arquivo. Por favor, tente uma foto mais nítida ou registre manualmente.',
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

      const { text, keyboard } = buildAiConfirmationMessage(
        extractedList,
        pendingId,
      );

      await this.bot.telegram.sendMessage(Number(telegramId), text, {
        parse_mode: 'Markdown',
        ...keyboard,
      });

      return { success: true, pendingId, count: extractedList.length };
    } catch (error) {
      this.logger.error(`Error processing job ${job.id ?? 'unknown'}:`, error);
      await this.bot.telegram.sendMessage(
        Number(telegramId),
        '❌ Desculpe, ocorreu um erro ao processar seu arquivo com IA. Por favor, tente novamente ou registre manualmente.',
      );
      throw error;
    }
  }
}
