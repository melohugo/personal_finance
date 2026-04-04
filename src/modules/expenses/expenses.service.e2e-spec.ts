import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../../common/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';

describe('ExpensesService (Integration)', () => {
  let service: ExpensesService;
  let prisma: PrismaService;
  let container: StartedPostgreSqlContainer;

  const telegramId = 999888777n;

  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    const databaseUrl = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getMappedPort(5432)}/${container.getDatabase()}?schema=public`;

    // Run migrations (db push) to sync schema with the container database
    execSync(`npx prisma db push --url="${databaseUrl}" --accept-data-loss`, {
      stdio: 'inherit',
    });

    process.env.DATABASE_URL = databaseUrl;

    const module: TestingModule = await Test.createTestingModule({
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
  }, 60000); // Higher timeout for container start

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    // Basic cleanup for each test if necessary (though we start with a fresh DB)
    await prisma.expense.deleteMany({ where: { telegram_id: telegramId } });
    await prisma.category.deleteMany({ where: { telegram_id: telegramId } });
    await prisma.user.deleteMany({ where: { telegram_id: telegramId } });

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
      where: { name_telegram_id: { name: categoryName, telegram_id: telegramId } },
    });
    expect(category).toBeDefined();
    expect(category?.name).toBe(categoryName);

    const expense = await prisma.expense.findFirst({
      where: { telegram_id: telegramId, category_id: category?.id },
    });
    expect(expense).toBeDefined();
    expect(Number(expense?.amount)).toBe(amount);
  });
});
