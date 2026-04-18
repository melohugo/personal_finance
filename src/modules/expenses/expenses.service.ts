import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface CreateExpenseFromTelegramDto {
  telegramId: bigint;
  amount: number;
  categoryName: string;
}

export interface ListExpensesDto {
  telegramId: bigint;
  range: {
    start: Date;
    end: Date;
  };
}

export interface UpdateExpenseDto {
  amount?: number;
  categoryName?: string;
  date?: Date;
  description?: string;
}

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async createFromTelegram(dto: CreateExpenseFromTelegramDto) {
    const { telegramId, amount, categoryName } = dto;

    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    return await this.prisma.expense.create({
      data: {
        amount: amount,
        date: new Date(),
        user: {
          connect: { telegram_id: telegramId },
        },
        category: {
          connectOrCreate: {
            where: {
              name_telegram_id: {
                name: categoryName,
                telegram_id: telegramId,
              },
            },
            create: {
              name: categoryName,
              telegram_id: telegramId,
            },
          },
        },
      },
    });
  }

  async updateExpense(
    telegramId: bigint,
    expenseId: string,
    dto: UpdateExpenseDto,
  ) {
    const { amount, categoryName, date, description } = dto;

    const data: any = {};
    if (amount !== undefined) {
      if (amount <= 0) throw new Error('Amount must be greater than zero');
      data.amount = amount;
    }
    if (date !== undefined) data.date = date;
    if (description !== undefined) data.description = description;

    if (categoryName !== undefined) {
      data.category = {
        connectOrCreate: {
          where: {
            name_telegram_id: {
              name: categoryName,
              telegram_id: telegramId,
            },
          },
          create: {
            name: categoryName,
            telegram_id: telegramId,
          },
        },
      };
    }

    return await this.prisma.expense.update({
      where: {
        id: expenseId,
        telegram_id: telegramId,
      },
      data,
    });
  }

  async updateCategory(
    telegramId: bigint,
    categoryId: string,
    newName: string,
  ) {
    return await this.prisma.category.update({
      where: {
        id: categoryId,
        telegram_id: telegramId,
      },
      data: {
        name: newName,
      },
    });
  }

  async listExpenses(dto: ListExpensesDto) {
    const { telegramId, range } = dto;

    const expenses = await this.prisma.expense.findMany({
      where: {
        telegram_id: telegramId,
        date: {
          gte: range.start,
          lte: range.end,
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Agrupar por Mês/Ano
    const groupedByMonth: Record<
      string,
      {
        month: number;
        year: number;
        total: number;
        byCategory: Record<string, { name: string; amount: number }>;
      }
    > = {};

    for (const exp of expenses) {
      const month = exp.date.getMonth();
      const year = exp.date.getFullYear();
      const key = `${year}-${month}`;

      if (!groupedByMonth[key]) {
        groupedByMonth[key] = {
          month,
          year,
          total: 0,
          byCategory: {},
        };
      }

      const amount = Number(exp.amount);
      groupedByMonth[key].total += amount;

      const catName = exp.category.name;
      if (!groupedByMonth[key].byCategory[catName]) {
        groupedByMonth[key].byCategory[catName] = { name: catName, amount: 0 };
      }
      groupedByMonth[key].byCategory[catName].amount += amount;
    }

    const sortedMonths = Object.values(groupedByMonth).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });

    // Calcular variações
    const resultMonths = sortedMonths.map((current, index) => {
      const prev = sortedMonths[index - 1];

      let diffTotal: number | undefined;
      if (prev && prev.total > 0) {
        diffTotal = ((current.total - prev.total) / prev.total) * 100;
      }

      const byCategoryList = Object.values(current.byCategory).map((cat) => {
        let diffPrevMonth: number | undefined;
        if (prev) {
          const prevCat = prev.byCategory[cat.name];
          if (prevCat && prevCat.amount > 0) {
            diffPrevMonth =
              ((cat.amount - prevCat.amount) / prevCat.amount) * 100;
          }
        }
        return {
          ...cat,
          diffPrevMonth,
        };
      });

      return {
        month: current.month,
        year: current.year,
        total: current.total,
        diffTotal,
        byCategory: byCategoryList,
      };
    });

    return {
      months: resultMonths,
      total: resultMonths.reduce((sum, m) => sum + m.total, 0),
    };
  }

  async listCategories(telegramId: bigint) {
    return await this.prisma.category.findMany({
      where: { telegram_id: telegramId },
      orderBy: { name: 'asc' },
    });
  }

  async listIndividualExpenses(dto: ListExpensesDto) {
    const { telegramId, range } = dto;

    return await this.prisma.expense.findMany({
      where: {
        telegram_id: telegramId,
        date: {
          gte: range.start,
          lte: range.end,
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async deleteExpense(id: string, telegramId: bigint) {
    return await this.prisma.expense.delete({
      where: {
        id,
        telegram_id: telegramId,
      },
    });
  }

  async deleteCategory(id: string, telegramId: bigint) {
    return await this.prisma.category.delete({
      where: {
        id,
        telegram_id: telegramId,
      },
    });
  }
}
