/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { TelegramModule } from './telegram.module';
import { PrismaService } from '../../common/prisma.service';
import { PrismaModule } from '../../common/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { TelegrafModule, getBotToken } from 'nestjs-telegraf';
import { BullModule } from '@nestjs/bullmq';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';
import { Context } from 'telegraf';
import { of } from 'rxjs';
import { randomUUID } from 'crypto';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomUUID: jest.fn().mockImplementation(() => actual.randomUUID()),
  };
});

describe('TelegramModule (Integration)', () => {
  let moduleRef: TestingModule;
  let service: TelegramService;
  let prisma: PrismaService;
  let container: StartedPostgreSqlContainer;
  let redisContainer: StartedTestContainer;

  const telegramId = 123456789n;

  beforeAll(async () => {
    // 1. Start Postgres
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    const databaseUrl = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getMappedPort(5432)}/${container.getDatabase()}?schema=public`;

    // 2. Start Redis
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();
    const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;

    execSync(`npx prisma db push --url="${databaseUrl}" --accept-data-loss`, {
      stdio: 'inherit',
    });

    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_URL = redisUrl;
    process.env.TELEGRAM_BOT_TOKEN = 'mock_token';

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        BullModule.forRoot({
          connection: {
            host: redisContainer.getHost(),
            port: redisContainer.getMappedPort(6379),
          },
        }),
        PrismaModule,
        TelegrafModule.forRoot({ token: 'mock_token' }),
        TelegramModule,
      ],
    })
      .overrideProvider(getBotToken())
      .useValue({
        handleUpdate: jest.fn(),
        launch: jest.fn(),
        stop: jest.fn(),
        telegram: {
          getMe: jest.fn().mockResolvedValue({ id: 1, first_name: 'Bot' }),
          setWebhook: jest.fn().mockResolvedValue(true),
          getWebhookInfo: jest.fn().mockResolvedValue({
            url: 'https://test.com',
            pending_update_count: 0,
          }),
        },
      })
      .overrideProvider(HttpService)
      .useValue({
        get: jest
          .fn()
          .mockReturnValue(
            of({ data: { results: [{ regularMarketPrice: 35 }] } }),
          ),
      })
      .compile();

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
    if (redisContainer) {
      await redisContainer.stop();
    }
  });

  jest.setTimeout(90000);

  beforeEach(async () => {
    await prisma.assetOperation.deleteMany({});
    await prisma.asset.deleteMany({});
    await prisma.expense.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});

    // Create user as most commands require a pre-existing user
    await prisma.user.create({
      data: { telegram_id: telegramId },
    });
  });

  const mockContext = (text: string, id: bigint, match: string[] = []) =>
    ({
      message: { text, from: { id: Number(id) } },
      from: { id: Number(id) },
      session: {},
      reply: jest.fn().mockResolvedValue({} as any),
      replyWithMarkdown: jest.fn().mockResolvedValue({} as any),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      callbackQuery: { data: '' },
      match,
    }) as unknown as Context;

  it('should list investments from real database using /listar investimentos', async () => {
    // 1. Setup Data
    const asset = await prisma.asset.create({
      data: { ticker: 'PETR4', type: 'STOCK' },
    });
    await prisma.assetOperation.create({
      data: {
        asset_id: asset.id,
        telegram_id: telegramId,
        quantity: 10,
        unit_price: 20,
        type: 'BUY',
        date: new Date(),
      },
    });

    const ctx = mockContext('/listar investimentos', telegramId);

    // 2. Execute
    await service.onListarCommand(ctx);

    // 3. Assert
    expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
      expect.stringContaining('PETR4'),
    );
    expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
      expect.stringContaining('Posição: 10'),
    );
    expect(ctx.replyWithMarkdown).toHaveBeenCalledWith(
      expect.stringContaining('Lucro: +R$ 150'),
    );
  });

  it('should complete the full trip: command /gasto -> service -> real database', async () => {
    const ctx = mockContext('/gasto 85.50 Restaurante', telegramId);

    await service.onGastoCommand(ctx);

    // Verify reply
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining(
        'Gasto de R$ 85.50 registrado em Restaurante! ✅',
      ),
    );

    // Verify database persistence
    const expense = await prisma.expense.findFirst({
      where: { telegram_id: telegramId },
      include: { category: true },
    });

    expect(expense).toBeDefined();
    expect(Number(expense?.amount)).toBe(85.5);
    expect(expense?.category.name).toBe('Restaurante');
  });

  it('should create a new user when /start is called', async () => {
    const newTelegramId = 555444333n;
    await prisma.user.deleteMany({ where: { telegram_id: newTelegramId } });

    const ctx = mockContext('/start', newTelegramId);
    await service.start(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Bem-vindo ao FinanceBot! 🚀'),
    );

    const user = await prisma.user.findUnique({
      where: { telegram_id: newTelegramId },
    });
    expect(user).toBeDefined();
  });

  it('should list and update an expense via session and action flow', async () => {
    // 1. Setup: Create an expense
    const category = await prisma.category.create({
      data: { name: 'Comida', telegram_id: telegramId },
    });
    const expense = await prisma.expense.create({
      data: {
        amount: 50.0,
        category_id: category.id,
        telegram_id: telegramId,
        date: new Date(),
      },
    });

    // 2. Execute /editar gastos
    const ctx = mockContext('/editar gastos', telegramId);
    await service.onEditarCommand(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Escolha um gasto para editar'),
      expect.any(Object),
    );

    // 3. Simulate click on the expense button
    const editCtx = mockContext('', telegramId, [
      `edit_exp_${expense.id}`,
      expense.id,
    ]);
    (editCtx.callbackQuery as any).data = `edit_exp_${expense.id}`;
    (editCtx as any).session = {}; // Persistent session simulation

    await service.onEditExpense(editCtx as any);
    expect(editCtx.session).toMatchObject({
      editId: expense.id,
      editType: 'expense',
    });

    // 4. Simulate field selection (amount)
    const fieldCtx = mockContext('', telegramId, [
      'edit_field_amount',
      'amount',
    ]);
    (fieldCtx.callbackQuery as any).data = 'edit_field_amount';
    (fieldCtx as any).session = editCtx.session;

    await service.onEditField(fieldCtx as any);
    expect(fieldCtx.session.editField).toBe('amount');

    // 5. Simulate sending new amount text
    const textCtx = mockContext('120.50', telegramId);
    (textCtx as any).session = fieldCtx.session;

    await service.onMessage(textCtx as any);

    // 6. Verify database
    const updated = await prisma.expense.findUnique({
      where: { id: expense.id },
    });
    expect(Number(updated?.amount)).toBe(120.5);
    expect(textCtx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Gasto atualizado com sucesso!'),
    );
  });

  it('should rename a category through integration flow', async () => {
    // 1. Setup
    const category = await prisma.category.create({
      data: { name: 'Antiga', telegram_id: telegramId },
    });

    // 2. Click category
    const editCtx = mockContext('', telegramId, [
      `edit_cat_${category.id}`,
      category.id,
    ]);
    (editCtx.callbackQuery as any).data = `edit_cat_${category.id}`;
    (editCtx as any).session = {};

    await service.onEditCategory(editCtx as any);

    // 3. Send new name
    const textCtx = mockContext('Nova Categoria', telegramId);
    (textCtx as any).session = editCtx.session;

    await service.onMessage(textCtx as any);

    // 4. Verify
    const updated = await prisma.category.findUnique({
      where: { id: category.id },
    });
    expect(updated?.name).toBe('Nova Categoria');
  });

  it('should process AI confirmation and save multiple expenses to real database', async () => {
    const pendingId = 'test-pending-123';
    const redisKey = `pending_expense:${pendingId}`;
    const mockData = {
      telegramId: telegramId.toString(),
      expenses: [
        {
          amount: 42.5,
          category: 'Alimentação',
          date: '2026-05-16',
          description: 'Lanche',
        },
        {
          amount: 10.0,
          category: 'Transporte',
          date: '2026-05-16',
          description: 'Ônibus',
        },
      ],
    };

    // 1. Manually seed Redis
    await service['redis'].set(redisKey, JSON.stringify(mockData));

    // 2. Execute onConfirmAI
    const ctx = mockContext('', telegramId, [
      `conf_ai:${pendingId}`,
      pendingId,
    ]);
    (ctx as any).editMessageText = jest.fn().mockResolvedValue({} as any);

    await service.onConfirmAI(ctx as any);

    // 3. Verify Database
    const expenses = await prisma.expense.findMany({
      where: { telegram_id: telegramId },
      include: { category: true },
    });

    expect(expenses).toHaveLength(2);
    expect(expenses.map((e) => Number(e.amount))).toContain(42.5);
    expect(expenses.map((e) => Number(e.amount))).toContain(10);
    expect(expenses.map((e) => e.category.name)).toContain('Alimentacao');
    expect(expenses.map((e) => e.category.name)).toContain('Transporte');

    // 4. Verify Redis cleanup
    const remains = await service['redis'].get(redisKey);
    expect(remains).toBeNull();
  });

  it('should detect duplicate when trying to register same expense and allow saving it', async () => {
    // 1. Create an existing expense manually
    const date = new Date(Date.UTC(2026, 4, 16));
    await prisma.category.create({
      data: {
        name: 'Alimentacao',
        telegram_id: telegramId,
        expenses: {
          create: {
            amount: 42.5,
            date: date,
            telegram_id: telegramId,
          },
        },
      },
    });

    // 2. Try to register same expense via AI confirmation
    const pendingId = 'ai-dup-test';
    const mockData = {
      telegramId: telegramId.toString(),
      expenses: [
        {
          amount: 42.5,
          category: 'Alimentacao',
          date: '2026-05-16',
          description: 'Lanche Repetido',
        },
      ],
    };
    await service['redis'].set(
      `pending_expense:${pendingId}`,
      JSON.stringify(mockData),
    );

    const ctx = mockContext('', telegramId, [
      `conf_ai:${pendingId}`,
      pendingId,
    ]);
    (ctx as any).editMessageText = jest.fn().mockResolvedValue({});
    (ctx as any).callbackQuery = { data: `conf_ai:${pendingId}` };

    if (!jest.isMockFunction(service['bot'].telegram.sendMessage)) {
      service['bot'].telegram.sendMessage = jest.fn().mockResolvedValue({});
    }

    // Predictable duplicate ID
    const dupId = 'uuid-dup-test-123';
    (randomUUID as jest.Mock).mockReturnValue(dupId);

    await service.onConfirmAI(ctx as any);

    // 3. Verify it was flagged as duplicate (0 saved, summary updated)
    expect(ctx.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('0 gastos registrados'),
    );

    // 4. Verify duplicate prompt was sent
    expect(service['bot'].telegram.sendMessage).toHaveBeenCalledWith(
      Number(telegramId),
      expect.stringContaining(
        'gasto de R$ 42.50 em Alimentacao já parece estar registrado',
      ),
      expect.any(Object),
    );

    // 5. Simulate user clicking "Não ❌" (dup_sav) to save anyway
    const ctxDup = mockContext('', telegramId, [`dup_sav:${dupId}`, dupId]);
    (ctxDup as any).editMessageText = jest.fn().mockResolvedValue({});
    (ctxDup as any).callbackQuery = { data: `dup_sav:${dupId}` };

    await service.onDuplicateSave(ctxDup as any);

    // 6. Verify second expense was created
    const expenses = await prisma.expense.findMany({
      where: { telegram_id: telegramId },
    });
    expect(expenses).toHaveLength(2);
    expect(ctxDup.editMessageText).toHaveBeenCalledWith(
      expect.stringContaining('Gasto registrado com sucesso'),
    );
  });

  it('should accept PDF document and enqueue processing job', async () => {
    // 1. Setup mock context for document
    const ctx = mockContext('', telegramId);
    (ctx.message as any).document = {
      file_id: 'pdf_id_123',
      mime_type: 'application/pdf',
    };

    // Explicitly mock the queue
    jest
      .spyOn(service['receiptQueue'], 'add')
      .mockResolvedValue({ id: 'job-pdf' } as any);

    // In E2E, the bot might be a real instance or a complex mock.
    // Let's mock the specific bot methods on the service instance if they are not already mocks.
    if (!jest.isMockFunction(service['bot'].telegram.getFileLink)) {
      service['bot'].telegram.getFileLink = jest
        .fn()
        .mockResolvedValue(new URL('https://api.telegram.org/file/bot/pdf123'));
    } else {
      (service['bot'].telegram.getFileLink as jest.Mock).mockResolvedValue(
        new URL('https://api.telegram.org/file/bot/pdf123'),
      );
    }

    // 2. Execute onDocument
    await service.onDocument(ctx as any);

    // 3. Verify
    expect(service['bot'].telegram.getFileLink).toHaveBeenCalledWith(
      'pdf_id_123',
    );
    expect(service['receiptQueue'].add).toHaveBeenCalledWith(
      'process_receipt',
      expect.objectContaining({
        fileUrl: 'https://api.telegram.org/file/bot/pdf123',
        fileMimeType: 'application/pdf',
        telegramId: telegramId.toString(),
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('PDF recebido'),
    );
  });
});
