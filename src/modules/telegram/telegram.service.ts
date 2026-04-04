import { Update, Start, Help, On, Ctx, Command } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { parseGastoCommand } from './telegram-parser.utils';
import { ExpensesService } from '../expenses/expenses.service';

@Update()
export class TelegramService {
  constructor(private readonly expensesService: ExpensesService) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply('Bem-vindo ao FinanceBot! 🚀\nUtilize os comandos para gerenciar seus gastos e investimentos.');
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await ctx.reply('Envie uma foto de nota fiscal para registrar um gasto ou utilize /gasto <valor> <categoria> para registro manual.');
  }

  @Command('gasto')
  async onGastoCommand(@Ctx() ctx: Context) {
    try {
      const messageText = (ctx.message as any).text;
      const args = messageText.replace(/^\/gasto\s*/, '');
      const { amount, categoryName } = parseGastoCommand(args);

      await this.expensesService.createFromTelegram({
        telegramId: BigInt(ctx.from?.id || 0),
        amount,
        categoryName,
      });

      await ctx.reply(`Gasto de R$ ${amount} registrado em ${categoryName}! ✅`);
    } catch (error: any) {
      if (error.message.includes('Use o formato') || error.message.includes('Valor inválido')) {
        return await ctx.reply(`⚠️ ${error.message}`);
      }

      // Prisma error code for record not found (User connection failed)
      if (error.message.includes('connect') || error.code === 'P2025') {
        return await ctx.reply('❌ Erro ao registrar gasto. Você já iniciou o bot com /start?');
      }

      console.error('Telegram Service Error:', error);
      await ctx.reply('❌ Ocorreu um erro inesperado. Tente novamente mais tarde.');
    }
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    await ctx.reply('Ainda estou aprendendo a processar textos. Tente enviar uma foto ou um comando como /gasto.');
  }
}
