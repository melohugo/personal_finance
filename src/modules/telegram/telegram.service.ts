import { Update, Start, Help, On, Ctx, Command, Action } from 'nestjs-telegraf';
import { Context, Markup } from 'telegraf';
import {
  parseGastoCommand,
  parseListarCommand,
  parseDeletarCommand,
  parseEditarCommand,
} from './telegram-parser.utils';
import {
  ExpensesService,
  UpdateExpenseDto,
} from '../expenses/expenses.service';
import { UsersService } from '../users/users.service';
import {
  InvestmentsService,
  UpdateOperationDto,
} from '../investments/investments.service';
<<<<<<< HEAD

interface SessionData {
  editType?: 'expense' | 'category' | 'investment';
  editId?: string;
  editField?: string;
}

interface MyContext extends Context {
  session: SessionData;
}
=======
>>>>>>> fd04497 (refactor: elimina uso de 'any' no TelegramService e melhora segurança de tipos)

interface SessionData {
  editType?: 'expense' | 'category' | 'investment';
  editId?: string;
  editField?: string;
}

interface MyContext extends Context {
  session: SessionData;
}

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
        '/listar investimentos - Lista sua carteira de ativos\n' +
        '/deletar <gastos|categorias|investimentos> [mês] - Exclui registros\n' +
        '/editar <gastos|categorias|investimentos> [mês] - Edita registros',
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

  @Command('deletar')
  async onDeletarCommand(@Ctx() ctx: Context) {
    try {
      if (!ctx.message || !('text' in ctx.message)) return;

      const args = ctx.message.text.replace(/^\/deletar\s*/, '');
      const telegramId = BigInt(ctx.from?.id || 0);
      const parsed = parseDeletarCommand(args);

      if (parsed.type === 'gastos') {
        const expenses = await this.expensesService.listIndividualExpenses({
          telegramId,
          range: parsed.range!,
        });

        if (expenses.length === 0) {
          return await ctx.reply('Nenhum gasto encontrado no período.');
        }

        const buttons = expenses.map((e) => [
          Markup.button.callback(
            `🗑️ R$ ${Number(e.amount).toFixed(2)} - ${e.category.name} (${e.date.toLocaleDateString('pt-BR')})`,
            `del:exp:${e.id}`,
          ),
        ]);

        await ctx.reply(
          'Escolha o item para deletar:',
          Markup.inlineKeyboard(buttons),
        );
      } else if (parsed.type === 'categorias') {
        const categories =
          await this.expensesService.listCategories(telegramId);

        if (categories.length === 0) {
          return await ctx.reply('Nenhuma categoria encontrada.');
        }

        const buttons = categories.map((c) => [
          Markup.button.callback(`🗑️ ${c.name}`, `del:cat:${c.id}`),
        ]);

        await ctx.reply(
          'Escolha a categoria para deletar:',
          Markup.inlineKeyboard(buttons),
        );
      } else if (parsed.type === 'investimentos') {
        const operations =
          await this.investmentsService.listIndividualOperations(
            telegramId,
            parsed.range!,
          );

        if (operations.length === 0) {
          return await ctx.reply('Nenhuma operação encontrada no período.');
        }

        const buttons = operations.map((op) => [
          Markup.button.callback(
            `🗑️ ${op.type} ${op.asset.ticker} - ${Number(op.quantity)} @ R$ ${Number(op.unit_price).toFixed(2)}`,
            `del:inv:${op.id}`,
          ),
        ]);

        await ctx.reply(
          'Escolha a operação para deletar:',
          Markup.inlineKeyboard(buttons),
        );
      }
    } catch (error) {
      await this.handleError(ctx, error, 'carregar dados para exclusão');
    }
  }

  @Command('editar')
  async onEditarCommand(@Ctx() ctx: Context) {
    try {
      if (!ctx.message || !('text' in ctx.message)) return;

      const args = ctx.message.text.replace(/^\/editar\s*/, '');
      const telegramId = BigInt(ctx.from?.id || 0);
      const parsed = parseEditarCommand(args);

      if (parsed.type === 'gastos') {
        const expenses = await this.expensesService.listIndividualExpenses({
          telegramId,
          range: parsed.range!,
        });

        if (expenses.length === 0) {
          return await ctx.reply('Nenhum gasto encontrado para o período.');
        }

        const buttons = expenses.map((exp) => {
          const date = exp.date.toLocaleDateString('pt-BR');
          const label = `${date} - R$ ${Number(exp.amount).toFixed(2)} - ${exp.category.name}`;
          return [Markup.button.callback(label, `edit_exp_${exp.id}`)];
        });

        await ctx.reply(
          'Escolha um gasto para editar:',
          Markup.inlineKeyboard(buttons),
        );
      } else if (parsed.type === 'categorias') {
        const categories =
          await this.expensesService.listCategories(telegramId);

        if (categories.length === 0) {
          return await ctx.reply('Nenhuma categoria encontrada.');
        }

        const buttons = categories.map((cat) => [
          Markup.button.callback(cat.name, `edit_cat_${cat.id}`),
        ]);

        await ctx.reply(
          'Escolha uma categoria para editar:',
          Markup.inlineKeyboard(buttons),
        );
      } else if (parsed.type === 'investimentos') {
        const operations =
          await this.investmentsService.listIndividualOperations(
            telegramId,
            parsed.range!,
          );

        if (operations.length === 0) {
          return await ctx.reply('Nenhuma operação encontrada para o período.');
        }

        const buttons = operations.map((op) => {
          const date = op.date.toLocaleDateString('pt-BR');
          const type = op.type === 'BUY' ? 'C' : 'V';
          const label = `${date} [${type}] ${op.asset.ticker}: ${Number(op.quantity)} @ R$ ${Number(op.unit_price).toFixed(2)}`;
          return [Markup.button.callback(label, `edit_inv_${op.id}`)];
        });

        await ctx.reply(
          'Escolha uma operação para editar:',
          Markup.inlineKeyboard(buttons),
        );
      }
    } catch (error) {
      await this.handleError(ctx, error, 'carregar dados para edição');
    }
  }

<<<<<<< HEAD
  @Action(/^del:(exp|cat|inv):(.+)$/)
  async onDeleteAction(@Ctx() ctx: Context) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const match = (ctx as any).match;
    const type = match[1];
    const id = match[2];

    const originalText = (ctx.callbackQuery.message as any)?.text || '';

    await ctx.editMessageText(
      `⚠️ *Deseja realmente deletar este item?*\n\nID: ${id}\nOriginal: ${originalText}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('Sim ✅', `conf_del:${type}:${id}`),
            Markup.button.callback('Não ❌', 'canc_del'),
          ],
        ]),
      },
=======
  @Action(/^edit_exp_(.+)$/)
  async onEditExpense(@Ctx() ctx: MyContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const expenseId = ctx.callbackQuery.data.replace('edit_exp_', '');
    ctx.session.editType = 'expense';
    ctx.session.editId = expenseId;

    await ctx.reply(
      'O que deseja alterar neste gasto?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Valor', 'edit_field_amount'),
          Markup.button.callback('Descrição', 'edit_field_description'),
        ],
        [Markup.button.callback('Categoria', 'edit_field_category')],
      ]),
    );
    await ctx.answerCbQuery();
  }

  @Action(/^edit_cat_(.+)$/)
  async onEditCategory(@Ctx() ctx: MyContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const categoryId = ctx.callbackQuery.data.replace('edit_cat_', '');
    ctx.session.editType = 'category';
    ctx.session.editId = categoryId;

    await ctx.reply('Envie o novo nome para esta categoria:');
    await ctx.answerCbQuery();
  }

  @Action(/^edit_inv_(.+)$/)
  async onEditInvestment(@Ctx() ctx: MyContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const operationId = ctx.callbackQuery.data.replace('edit_inv_', '');
    ctx.session.editType = 'investment';
    ctx.session.editId = operationId;

    await ctx.reply(
      'O que deseja alterar nesta operação?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Quantidade', 'edit_field_quantity'),
          Markup.button.callback('Preço Unitário', 'edit_field_price'),
        ],
      ]),
    );
    await ctx.answerCbQuery();
  }

  @Action(/^edit_field_(.+)$/)
  async onEditField(@Ctx() ctx: MyContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const field = ctx.callbackQuery.data.replace('edit_field_', '');
    ctx.session.editField = field;

    const fieldNames: Record<string, string> = {
      amount: 'o novo valor',
      description: 'a nova descrição',
      category: 'o novo nome da categoria',
      quantity: 'a nova quantidade',
      price: 'o novo preço unitário',
    };

    await ctx.reply(`Envie ${fieldNames[field] || 'o novo valor'}:`);
    await ctx.answerCbQuery();
  }

  @On('text')
<<<<<<< HEAD
  async onMessage(@Ctx() ctx: Context) {
    await ctx.reply(
      'Ainda estou aprendendo a processar textos. Tente enviar uma foto ou um comando como /gasto ou /listar.',
>>>>>>> 765b1e6 (feat: implementa tratadores de ações de clique e sessão no TelegramService)
    );
    await ctx.answerCbQuery();
  }

  @Action(/^conf_del:(exp|cat|inv):(.+)$/)
  async onConfirmDeleteAction(@Ctx() ctx: Context) {
    const match = (ctx as any).match;
    const type = match[1];
    const id = match[2];
    const telegramId = BigInt(ctx.from?.id || 0);

    try {
      if (type === 'exp') {
        await this.expensesService.deleteExpense(id, telegramId);
      } else if (type === 'cat') {
        await this.expensesService.deleteCategory(id, telegramId);
      } else if (type === 'inv') {
        await this.investmentsService.deleteOperation(id, telegramId);
      }

      await ctx.editMessageText('Excluído com sucesso ✅');
    } catch (error) {
      console.error('Delete action error:', error);
      await ctx.editMessageText('❌ Erro ao excluir o item. Tente novamente.');
    }
    await ctx.answerCbQuery();
  }

  @Action('canc_del')
  async onCancelDeleteAction(@Ctx() ctx: Context) {
    await ctx.editMessageText('Operação cancelada ❌');
    await ctx.answerCbQuery();
  }

  @Action(/^edit_exp_(.+)$/)
  async onEditExpense(@Ctx() ctx: MyContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const expenseId = ctx.callbackQuery.data.replace('edit_exp_', '');
    ctx.session.editType = 'expense';
    ctx.session.editId = expenseId;

    await ctx.reply(
      'O que deseja alterar neste gasto?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Valor', 'edit_field_amount'),
          Markup.button.callback('Descrição', 'edit_field_description'),
        ],
        [Markup.button.callback('Categoria', 'edit_field_category')],
      ]),
    );
    await ctx.answerCbQuery();
  }

  @Action(/^edit_cat_(.+)$/)
  async onEditCategory(@Ctx() ctx: MyContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const categoryId = ctx.callbackQuery.data.replace('edit_cat_', '');
    ctx.session.editType = 'category';
    ctx.session.editId = categoryId;

    await ctx.reply('Envie o novo nome para esta categoria:');
    await ctx.answerCbQuery();
  }

  @Action(/^edit_inv_(.+)$/)
  async onEditInvestment(@Ctx() ctx: MyContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const operationId = ctx.callbackQuery.data.replace('edit_inv_', '');
    ctx.session.editType = 'investment';
    ctx.session.editId = operationId;

    await ctx.reply(
      'O que deseja alterar nesta operação?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Quantidade', 'edit_field_quantity'),
          Markup.button.callback('Preço Unitário', 'edit_field_price'),
        ],
      ]),
    );
    await ctx.answerCbQuery();
  }

  @Action(/^edit_field_(.+)$/)
  async onEditField(@Ctx() ctx: MyContext) {
    if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
    const field = ctx.callbackQuery.data.replace('edit_field_', '');
    ctx.session.editField = field;

    const fieldNames: Record<string, string> = {
      amount: 'o novo valor',
      description: 'a nova descrição',
      category: 'o novo nome da categoria',
      quantity: 'a nova quantidade',
      price: 'o novo preço unitário',
    };

    await ctx.reply(`Envie ${fieldNames[field] || 'o novo valor'}:`);
    await ctx.answerCbQuery();
  }

  @On('text')
=======
>>>>>>> e069b41 (feat: finaliza fluxo de edição no TelegramService com processamento de texto)
  async onMessage(@Ctx() ctx: MyContext) {
    try {
      if (!ctx.message || !('text' in ctx.message)) return;

      const telegramId = BigInt(ctx.from?.id || 0);
      const text = ctx.message.text;

      // Processar Edição se houver estado na sessão
      if (ctx.session.editId) {
        await this.handleEditSession(ctx, telegramId, text);
        return;
      }

      await ctx.reply(
        'Ainda estou aprendendo a processar textos. Tente enviar uma foto ou um comando como /gasto ou /listar.',
      );
    } catch (error) {
      await this.handleError(ctx, error, 'processar mensagem');
    }
  }

  private async handleEditSession(
    ctx: MyContext,
    telegramId: bigint,
    text: string,
  ) {
    const { editType, editId, editField } = ctx.session;

    if (editType === 'expense') {
<<<<<<< HEAD
<<<<<<< HEAD
      const updateData: UpdateExpenseDto = {};
=======
      const updateData: any = {};
>>>>>>> e069b41 (feat: finaliza fluxo de edição no TelegramService com processamento de texto)
=======
      const updateData: UpdateExpenseDto = {};
>>>>>>> fd04497 (refactor: elimina uso de 'any' no TelegramService e melhora segurança de tipos)
      if (editField === 'amount') {
        const amount = parseFloat(text.replace(',', '.'));
        if (isNaN(amount)) throw new Error('Valor inválido.');
        updateData.amount = amount;
      } else if (editField === 'description') {
        updateData.description = text;
      } else if (editField === 'category') {
        updateData.categoryName = text;
      }

      await this.expensesService.updateExpense(telegramId, editId!, updateData);
      await ctx.reply('Gasto atualizado com sucesso! ✅');
    } else if (editType === 'category') {
      await this.expensesService.updateCategory(telegramId, editId!, text);
      await ctx.reply('Categoria atualizada com sucesso! ✅');
    } else if (editType === 'investment') {
<<<<<<< HEAD
<<<<<<< HEAD
      const updateData: UpdateOperationDto = {};
=======
      const updateData: any = {};
>>>>>>> e069b41 (feat: finaliza fluxo de edição no TelegramService com processamento de texto)
=======
      const updateData: UpdateOperationDto = {};
>>>>>>> fd04497 (refactor: elimina uso de 'any' no TelegramService e melhora segurança de tipos)
      if (editField === 'quantity') {
        const qty = parseFloat(text.replace(',', '.'));
        if (isNaN(qty)) throw new Error('Quantidade inválida.');
        updateData.quantity = qty;
      } else if (editField === 'price') {
        const price = parseFloat(text.replace(',', '.'));
        if (isNaN(price)) throw new Error('Preço inválido.');
        updateData.unit_price = price;
      }

      await this.investmentsService.updateOperation(
        telegramId,
        editId!,
        updateData,
      );
      await ctx.reply('Operação de investimento atualizada com sucesso! ✅');
    }

    // Limpar sessão após edição
    ctx.session.editId = undefined;
    ctx.session.editType = undefined;
    ctx.session.editField = undefined;
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
