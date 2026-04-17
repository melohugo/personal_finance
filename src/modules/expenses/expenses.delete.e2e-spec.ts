import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../../common/prisma.service';
import { ConfigModule } from '@nestjs/config';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';

describe('ExpensesService Delete (Integration)', () => {
  let module: TestingModule;
  let service: ExpensesService;
  let prisma: PrismaService;
  let container: StartedPostgreSqlContainer;

  const telegramId = BigInt(111222333);
  const otherTelegramId = BigInt(444555666);

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    const databaseUrl = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getMappedPort(5432)}/${container.getDatabase()}?schema=public`;

    execSync(`npx prisma db push --url="${databaseUrl}" --accept-data-loss`, {
      stdio: 'inherit',
    });

    process.env.DATABASE_URL = databaseUrl;

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
        }),
      ],
      providers: [ExpensesService, PrismaService],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
  }, 60000);

  afterAll(async () => {
    if (module) await module.close();
    if (container) await container.stop();
  });

  beforeEach(async () => {
    await prisma.expense.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.user.createMany({
      data: [{ telegram_id: telegramId }, { telegram_id: otherTelegramId }],
    });
  });

  describe('listIndividualExpenses', () => {
    it('should list only user expenses in the given range', async () => {
      const cat = await prisma.category.create({
        data: { name: 'Food', telegram_id: telegramId },
      });

      await prisma.expense.createMany({
        data: [
          {
            amount: 50,
            date: new Date(2024, 0, 15),
            telegram_id: telegramId,
            category_id: cat.id,
          },
          {
            amount: 100,
            date: new Date(2024, 1, 15),
            telegram_id: telegramId,
            category_id: cat.id,
          },
        ],
      });

      const result = await service.listIndividualExpenses({
        telegramId,
        range: {
          start: new Date(2024, 0, 1),
          end: new Date(2024, 0, 31, 23, 59, 59),
        },
      });

      expect(result).toHaveLength(1);
      expect(Number(result[0].amount)).toBe(50);
    });
  });

  describe('deleteExpense', () => {
    it('should delete a specific expense', async () => {
      const cat = await prisma.category.create({
        data: { name: 'Food', telegram_id: telegramId },
      });
      const exp = await prisma.expense.create({
        data: {
          amount: 50,
          date: new Date(),
          telegram_id: telegramId,
          category_id: cat.id,
        },
      });

      await service.deleteExpense(exp.id, telegramId);

      const found = await prisma.expense.findUnique({ where: { id: exp.id } });
      expect(found).toBeNull();
    });

    it('should not delete an expense from another user', async () => {
      const catOther = await prisma.category.create({
        data: { name: 'Food', telegram_id: otherTelegramId },
      });
      const expOther = await prisma.expense.create({
        data: {
          amount: 50,
          date: new Date(),
          telegram_id: otherTelegramId,
          category_id: catOther.id,
        },
      });

      await expect(
        service.deleteExpense(expOther.id, telegramId),
      ).rejects.toThrow();

      const found = await prisma.expense.findUnique({
        where: { id: expOther.id },
      });
      expect(found).not.toBeNull();
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category and fail if there are expenses linked', async () => {
      const cat = await prisma.category.create({
        data: { name: 'Food', telegram_id: telegramId },
      });

      await service.deleteCategory(cat.id, telegramId);

      const found = await prisma.category.findUnique({ where: { id: cat.id } });
      expect(found).toBeNull();
    });

    it('should fail to delete a category that belongs to another user', async () => {
      const catOther = await prisma.category.create({
        data: { name: 'Food', telegram_id: otherTelegramId },
      });

      await expect(
        service.deleteCategory(catOther.id, telegramId),
      ).rejects.toThrow();

      const found = await prisma.category.findUnique({
        where: { id: catOther.id },
      });
      expect(found).not.toBeNull();
    });
  });
});
