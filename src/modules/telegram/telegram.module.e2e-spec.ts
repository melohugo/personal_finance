import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { TelegramModule } from './telegram.module';
import { PrismaService } from '../../common/prisma.service';
import { ConfigModule } from '@nestjs/config';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { Context } from 'telegraf';

describe('TelegramModule (Integration)', () => {
  let moduleRef: TestingModule;
  let service: TelegramService;
  let prisma: PrismaService;
  let container: StartedPostgreSqlContainer;

  const telegramId = 123456789n;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    const databaseUrl = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getMappedPort(5432)}/${container.getDatabase()}?schema=public`;

    execSync(`npx prisma db push --url="${databaseUrl}" --accept-data-loss`, {
      stdio: 'inherit',
    });

    process.env.DATABASE_URL = databaseUrl;
    process.env.TELEGRAM_BOT_TOKEN = 'mock_token'; // Prevents telegraf from failing

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TelegramModule,
      ],
    }).compile();

    service = moduleRef.get<TelegramService>(TelegramService);
    prisma = moduleRef.get<PrismaService>(PrismaService);
    await prisma.$connect();
  }, 60000);

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    await prisma.expense.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});

    // Create user as /gasto requires a pre-existing user
    await prisma.user.create({
      data: { telegram_id: telegramId },
    });
  });

  const mockContext = (text: string, id: bigint) => ({
    message: { text, from: { id: Number(id) } },
    from: { id: Number(id) },
    reply: jest.fn(),
  } as unknown as Context);

  it('should complete the full trip: command -> service -> real database', async () => {
    const ctx = mockContext('/gasto 85.50 Restaurante', telegramId);

    await service.onGastoCommand(ctx);

    // Verify reply
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Gasto de R$ 85.5 registrado em Restaurante! ✅')
    );

    // Verify database persistence
    const expense = await prisma.expense.findFirst({
      where: { telegram_id: telegramId },
      include: { category: true }
    });

    expect(expense).toBeDefined();
    expect(Number(expense?.amount)).toBe(85.5);
    expect(expense?.category.name).toBe('Restaurante');
  });

  it('should handle large Telegram IDs correctly (BigInt)', async () => {
    const largeId = 999999999999n;
    await prisma.user.create({ data: { telegram_id: largeId } });
    
    const ctx = mockContext('/gasto 10 Teste', largeId);
    await service.onGastoCommand(ctx);

    const expense = await prisma.expense.findFirst({
      where: { telegram_id: largeId }
    });
    expect(expense?.telegram_id).toBe(largeId);
  });
});
