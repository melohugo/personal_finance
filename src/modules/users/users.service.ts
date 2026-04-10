import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateUser(telegramId: bigint) {
    return await this.prisma.user.upsert({
      where: { telegram_id: telegramId },
      update: {},
      create: { telegram_id: telegramId },
    });
  }
}
