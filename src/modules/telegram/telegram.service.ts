import { Update, Start, Help, On, Ctx, Command } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { parseGastoCommand, parseListarCommand } from './telegram-parser.utils';
import { ExpensesService } from '../expenses/expenses.service';
import { UsersService } from '../users/users.service';
import { InvestmentsService } from '../investments/investments.service';

@Update()
export class TelegramService {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly usersService: UsersService,
    private readonly investmentsService: InvestmentsService,
  ) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    const telegramId = BigInt(ctx.from?.id || 0);
    await this.usersService.getOrCreateUser(telegramId);

    await ctx.reply(
      'Bem-vindo ao FinanceBot! 🚀\nUtilize os comandos para gerenciar seus gastos e investimentos.',
    );
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await ctx.reply(
      'Comandos disponíveis:\n' +
        '/gasto <valor> <categoria> - Registra um gasto manual\n' +
        '/listar gastos [mês] [intervalo] - Lista gastos\n' +
        '/listar categorias - Lista categorias registradas\n' +
        '/listar investimentos - Lista sua carteira de ativos',
    );
  }

  @Command('gasto')
  async onGastoCommand(@Ctx() ctx: Context) {
    try {
      if (!ctx.message || !('text' in ctx.message)) {
        return;
      }

      const messageText = ctx.message.text;
      const args = messageText.replace(/^\/gasto\s*/, '');
      const { amount, categoryName } = parseGastoCommand(args);

      await this.expensesService.createFromTelegram({
        telegramId: BigInt(ctx.from?.id || 0),
        amount,
        categoryName,
      });

      await ctx.reply(
        `Gasto de R$ ${amount} registrado em ${categoryName}! ✅`,
      );
    } catch (error) {
      await this.handleError(ctx, error, 'registrar gasto');
    }
  }

  @Command('listar')
  async onListarCommand(@Ctx() ctx: Context) {
    try {
      if (!ctx.message || !('text' in ctx.message)) return;

      const args = ctx.message.text.replace(/^\/listar\s*/, '');
      const telegramId = BigInt(ctx.from?.id || 0);
      const parsed = parseListarCommand(args);

      if (parsed.type === 'gastos' && parsed.range) {
        const report = await this.expensesService.listExpenses({
          telegramId,
          range: parsed.range,
        });

        let message = '📊 *Relatório de Gastos*\n\n';
        for (const month of report.months) {
          const monthName = new Date(month.year, month.month).toLocaleString(
            'pt-BR',
            { month: 'long' },
          );
          message += `*${monthName}/${month.year}*\n`;
          for (const cat of month.byCategory) {
            message += `• ${cat.name}: R$ ${cat.amount.toFixed(2)}`;
            if (cat.diffPrevMonth !== undefined) {
              const sign = cat.diffPrevMonth > 0 ? '+' : '';
              message += ` (${sign}${cat.diffPrevMonth.toFixed(1)}%)`;
            }
            message += '\n';
          }
          message += `*Total: R$ ${month.total.toFixed(2)}*`;
          if (month.diffTotal !== undefined) {
            const sign = month.diffTotal > 0 ? '+' : '';
            message += ` (${sign}${month.diffTotal.toFixed(1)}%)`;
          }
          message += '\n\n';
        }

        if (report.months.length > 1) {
          message += `*Total Acumulado: R$ ${report.total.toFixed(2)}*`;
        }

        await ctx.replyWithMarkdown(message);
      } else if (parsed.type === 'categorias') {
        const categories =
          await this.expensesService.listCategories(telegramId);
        const list = categories.map((c) => `• ${c.name}`).join('\n');
        await ctx.reply(`Categorias registradas:\n${list}`);
      } else if (parsed.type === 'investimentos') {
        const result =
          await this.investmentsService.listUserInvestments(telegramId);

        let message = '💰 *Carteira de Investimentos*\n\n';

        for (const asset of result.assets) {
          message += `*${asset.ticker}*\n`;
          message += `Posição: ${asset.position}\n`;
          message += `PM: R$ ${asset.pm.toFixed(2)}\n`;

          if (asset.currentPrice !== null) {
            message += `Preço Atual: R$ ${asset.currentPrice.toFixed(2)}\n`;
            const sign = asset.profit !== null && asset.profit >= 0 ? '+' : '';
            message += `Lucro: ${sign}R$ ${asset.profit?.toFixed(2)} (${sign}${asset.profitPercentage?.toFixed(2)}%)\n`;
          } else {
            message += `⚠️ Preço indisponível\n`;
          }
          message += '\n';
        }

        message += `*Total Alocado: R$ ${result.totalAllocation.toFixed(2)}*\n`;
        const totalSign = result.totalProfit >= 0 ? '+' : '';
        message += `*Lucro Total: ${totalSign}R$ ${result.totalProfit.toFixed(2)}*`;

        await ctx.replyWithMarkdown(message);
      }
    } catch (error) {
      await this.handleError(ctx, error, 'listar dados');
    }
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    await ctx.reply(
      'Ainda estou aprendendo a processar textos. Tente enviar uma foto ou um comando como /gasto ou /listar.',
    );
  }

  private async handleError(ctx: Context, error: unknown, action: string) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message.includes('Tipo de listagem') ||
      message.includes('Mês inválido') ||
      message.includes('Use o formato') ||
      message.includes('Valor inválido')
    ) {
      return await ctx.reply(`⚠️ ${message}`);
    }

    const hasCode = (obj: unknown): obj is { code: string } =>
      typeof obj === 'object' && obj !== null && 'code' in obj;

    if (
      message.includes('connect') ||
      (hasCode(error) && error.code === 'P2025')
    ) {
      return await ctx.reply(
        `❌ Erro ao ${action}. Você já iniciou o bot com /start?`,
      );
    }

    console.error(`Telegram Service Error (${action}):`, error);
    await ctx.reply(
      '❌ Ocorreu um erro inesperado. Tente novamente mais tarde.',
    );
  }
}
