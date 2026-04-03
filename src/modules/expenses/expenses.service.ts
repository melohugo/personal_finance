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
    throw new Error('Not implemented');
  }
}
