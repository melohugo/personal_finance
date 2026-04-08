import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../../common/prisma.service';
import { ConfigModule } from '@nestjs/config';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';

describe('ExpensesService (Integration)', () => {
  let module: TestingModule;
  let service: ExpensesService;
  let prisma: PrismaService;
  let container: StartedPostgreSqlContainer;

  const telegramId = 999888777n;

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
    if (module) {
      await module.close();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    await prisma.expense.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.user.create({
      data: { telegram_id: telegramId },
    });
  });

  it('should persist expense and category in the database', async () => {
    const amount = 125.75;
    const categoryName = 'Saúde';

    const result = await service.createFromTelegram({
      telegramId,
      amount,
      categoryName,
    });

    expect(result).toBeDefined();
    expect(Number(result.amount)).toBe(amount);

    const category = await prisma.category.findUnique({
      where: {
        name_telegram_id: { name: categoryName, telegram_id: telegramId },
      },
    });
    expect(category).toBeDefined();
    expect(category?.name).toBe(categoryName);
  });

  it('should reuse existing category for the same user', async () => {
    const categoryName = 'Alimentação';

    await service.createFromTelegram({ telegramId, amount: 50, categoryName });
    await service.createFromTelegram({ telegramId, amount: 100, categoryName });

    const categories = await prisma.category.findMany({
      where: { telegram_id: telegramId, name: categoryName },
    });

    expect(categories).toHaveLength(1);
    const expenses = await prisma.expense.findMany({
      where: { telegram_id: telegramId, category_id: categories[0].id },
    });
    expect(expenses).toHaveLength(2);
  });

  it('should handle high precision decimal amounts correctly', async () => {
    const amount = 0.12345678;
    const categoryName = 'Investimento';

    const result = await service.createFromTelegram({
      telegramId,
      amount,
      categoryName,
    });

    const expense = await prisma.expense.findUnique({
      where: { id: result.id },
    });

    expect(expense?.amount.toNumber()).toBe(amount);
  });

  it('should throw an error if user does not exist', async () => {
    const nonExistentId = 12345n;

    await expect(
      service.createFromTelegram({
        telegramId: nonExistentId,
        amount: 10,
        categoryName: 'Teste',
      }),
    ).rejects.toThrow();
  });

  it('should handle concurrent requests for a new category without duplication', async () => {
    const categoryName = 'Novo';
    const amount = 10;

    await Promise.all([
      service.createFromTelegram({ telegramId, amount, categoryName }),
      service.createFromTelegram({ telegramId, amount, categoryName }),
    ]);

    const categories = await prisma.category.findMany({
      where: { telegram_id: telegramId, name: categoryName },
    });

    expect(categories).toHaveLength(1);
  });
});
