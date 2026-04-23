/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { TelegramService } from './telegram.service';
import { TelegramModule } from './telegram.module';
import { PrismaService } from '../../common/prisma.service';
import { PrismaModule } from '../../common/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { Context } from 'telegraf';
import { getBotToken } from 'nestjs-telegraf';
import { of } from 'rxjs';

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
    process.env.TELEGRAM_BOT_TOKEN = 'mock_token';

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
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
  });

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

  const mockContext = (text: string, id: bigint) =>
    ({
      message: { text, from: { id: Number(id) } },
      from: { id: Number(id) },
      session: {},
      reply: jest.fn().mockResolvedValue({} as any),
      replyWithMarkdown: jest.fn().mockResolvedValue({} as any),
      answerCbQuery: jest.fn().mockResolvedValue(true),
      callbackQuery: { data: '' },
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
      expect.stringContaining('Gasto de R$ 85.50 registrado em Restaurante! ✅'),
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
    const editCtx = mockContext('', telegramId);
    (editCtx.callbackQuery as any).data = `edit_exp_${expense.id}`;
    (editCtx as any).session = {}; // Persistent session simulation

    await service.onEditExpense(editCtx as any);
    expect(editCtx.session).toMatchObject({
      editId: expense.id,
      editType: 'expense',
    });

    // 4. Simulate field selection (amount)
    const fieldCtx = mockContext('', telegramId);
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
    const editCtx = mockContext('', telegramId);
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
});
