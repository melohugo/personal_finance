import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface CreateExpenseFromTelegramDto {
  telegramId: bigint;
  amount: number;
  categoryName: string;
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
}
