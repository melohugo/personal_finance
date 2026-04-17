import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { PrismaService } from '../../common/prisma.service';
import { MarketModule } from '../market/market.module';
import { ConfigModule } from '@nestjs/config';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';

describe('InvestmentsService Delete (Integration)', () => {
  let module: TestingModule;
  let service: InvestmentsService;
  let prisma: PrismaService;
  let container: StartedPostgreSqlContainer;

  const telegramId = BigInt(123456789);
  const otherTelegramId = BigInt(987654321);

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
        MarketModule,
      ],
      providers: [InvestmentsService, PrismaService],
    }).compile();

    service = module.get<InvestmentsService>(InvestmentsService);
    prisma = module.get<PrismaService>(PrismaService);
    await prisma.$connect();
  }, 60000);

  afterAll(async () => {
    if (module) await module.close();
    if (container) await container.stop();
  });

  beforeEach(async () => {
    await prisma.assetOperation.deleteMany({});
    await prisma.asset.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.user.createMany({
      data: [{ telegram_id: telegramId }, { telegram_id: otherTelegramId }],
    });
  });

  describe('listIndividualOperations', () => {
    it('should list only user operations in the given range', async () => {
      const asset = await prisma.asset.create({
        data: { ticker: 'PETR4', type: 'STOCK' },
      });

      await prisma.assetOperation.createMany({
        data: [
          {
            asset_id: asset.id,
            telegram_id: telegramId,
            quantity: 10,
            unit_price: 20,
            type: 'BUY',
            date: new Date(2024, 0, 15),
          },
          {
            asset_id: asset.id,
            telegram_id: otherTelegramId,
            quantity: 5,
            unit_price: 25,
            type: 'BUY',
            date: new Date(2024, 0, 15),
          },
        ],
      });

      const result = await service.listIndividualOperations(telegramId, {
        start: new Date(2024, 0, 1),
        end: new Date(2024, 0, 31, 23, 59, 59),
      });

      expect(result).toHaveLength(1);
      expect(Number(result[0].quantity)).toBe(10);
    });
  });

  describe('deleteOperation', () => {
    it('should delete a specific operation', async () => {
      const asset = await prisma.asset.create({
        data: { ticker: 'PETR4', type: 'STOCK' },
      });
      const op = await prisma.assetOperation.create({
        data: {
          asset_id: asset.id,
          telegram_id: telegramId,
          quantity: 10,
          unit_price: 20,
          type: 'BUY',
          date: new Date(),
        },
      });

      await service.deleteOperation(op.id, telegramId);

      const found = await prisma.assetOperation.findUnique({
        where: { id: op.id },
      });
      expect(found).toBeNull();
    });

    it('should not delete an operation from another user', async () => {
      const asset = await prisma.asset.create({
        data: { ticker: 'PETR4', type: 'STOCK' },
      });
      const opOther = await prisma.assetOperation.create({
        data: {
          asset_id: asset.id,
          telegram_id: otherTelegramId,
          quantity: 10,
          unit_price: 20,
          type: 'BUY',
          date: new Date(),
        },
      });

      await expect(
        service.deleteOperation(opOther.id, telegramId),
      ).rejects.toThrow();

      const found = await prisma.assetOperation.findUnique({
        where: { id: opOther.id },
      });
      expect(found).not.toBeNull();
    });
  });
});
