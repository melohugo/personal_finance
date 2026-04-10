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

  it('should list expenses for a specific period grouped by month', async () => {
    const catName = 'Alimentação';
    const cat = await prisma.category.create({
      data: { name: catName, telegram_id: telegramId },
    });

    await prisma.expense.createMany({
      data: [
        { amount: 100, date: new Date(2023, 0, 15), telegram_id: telegramId, category_id: cat.id },
        { amount: 200, date: new Date(2023, 1, 15), telegram_id: telegramId, category_id: cat.id },
      ],
    });

    const result = await service.listExpenses({
      telegramId,
      range: {
        start: new Date(2023, 0, 1),
        end: new Date(2023, 1, 28, 23, 59, 59),
      },
    });

    expect(result.months).toHaveLength(2);
    const jan = result.months.find(m => m.month === 0);
    expect(jan?.total).toBe(100);
  });

  it('should calculate percentages comparing with previous month in a range with realistic categories', async () => {
    const foodName = 'Alimentação';
    const gymName = 'Academia';

    const c1 = await prisma.category.create({ data: { name: foodName, telegram_id: telegramId } });
    const c2 = await prisma.category.create({ data: { name: gymName, telegram_id: telegramId } });

    // Janeiro: Alimentação 100, Academia 100 (Total 200)
    await prisma.expense.createMany({
      data: [
        { amount: 100, date: new Date(2024, 0, 10), telegram_id: telegramId, category_id: c1.id },
        { amount: 100, date: new Date(2024, 0, 20), telegram_id: telegramId, category_id: c2.id },
      ],
    });

    // Fevereiro: Alimentação 150 (Total 150)
    await prisma.expense.create({
      data: { amount: 150, date: new Date(2024, 1, 10), telegram_id: telegramId, category_id: c1.id },
    });

    const result = await service.listExpenses({
      telegramId,
      range: {
        start: new Date(2024, 0, 1),
        end: new Date(2024, 1, 29, 23, 59, 59),
      },
    });

    const jan = result.months.find(m => m.month === 0);
    const fev = result.months.find(m => m.month === 1);

    expect(jan?.total).toBe(200);
    expect(fev?.total).toBe(150);

    // Variação total fev vs jan: (150 - 200) / 200 = -0.25 (-25%)
    expect(fev?.diffTotal).toBe(-25);

    // Variação Alimentação fev vs jan: (150 - 100) / 100 = 0.5 (50%)
    const foodFev = fev?.byCategory.find(c => c.name === foodName);
    expect(foodFev?.diffPrevMonth).toBe(50);
  });
});
