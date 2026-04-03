import { Update, Start, Help, On, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';

@Update()
export class TelegramService {
  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply('Bem-vindo ao FinanceBot! 🚀\nUtilize os comandos para gerenciar seus gastos e investimentos.');
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await ctx.reply('Envie uma foto de nota fiscal para registrar um gasto ou utilize /investir para registrar ativos.');
  }

  @On('text')
  async onMessage(@Ctx() ctx: Context) {
    await ctx.reply('Ainda estou aprendendo a processar textos. Tente enviar uma foto ou um comando.');
  }
}
