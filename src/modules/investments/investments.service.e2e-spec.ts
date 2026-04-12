import { Test, TestingModule } from '@nestjs/testing';
import { InvestmentsService } from './investments.service';
import { PrismaService } from '../../common/prisma.service';
import { MarketModule } from '../market/market.module';
import { ConfigModule } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';

describe('InvestmentsService (Integration)', () => {
  let module: TestingModule;
  let service: InvestmentsService;
  let prisma: PrismaService;
  let container: StartedPostgreSqlContainer;
  let httpService: HttpService;

  const telegramId = 123456789n;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine').start();
    const databaseUrl = `postgresql://${container.getUsername()}:${container.getPassword()}@${container.getHost()}:${container.getMappedPort(5432)}/${container.getDatabase()}?schema=public`;

    // Sincroniza o schema com o banco do container
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
    })
    .overrideProvider(HttpService)
    .useValue({
        get: jest.fn(),
    })
    .compile();

    service = module.get<InvestmentsService>(InvestmentsService);
    prisma = module.get<PrismaService>(PrismaService);
    httpService = module.get<HttpService>(HttpService);
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

    await prisma.user.create({
      data: { telegram_id: telegramId },
    });
  });

  it('should calculate full portfolio performance from database with mocked market prices', async () => {
    // 1. Setup Assets
    const petr4 = await prisma.asset.create({
      data: { ticker: 'PETR4', type: 'STOCK' },
    });
    const vale3 = await prisma.asset.create({
      data: { ticker: 'VALE3', type: 'STOCK' },
    });

    // 2. Setup Operations
    // PETR4: Buy 10 @ 20, Buy 10 @ 30, Sell 5 @ 40 => Pos 15, PM 25
    await prisma.assetOperation.createMany({
      data: [
        { asset_id: petr4.id, telegram_id: telegramId, quantity: 10, unit_price: 20, type: 'BUY', date: new Date('2023-01-01') },
        { asset_id: petr4.id, telegram_id: telegramId, quantity: 10, unit_price: 30, type: 'BUY', date: new Date('2023-01-02') },
        { asset_id: petr4.id, telegram_id: telegramId, quantity: 5, unit_price: 40, type: 'SELL', date: new Date('2023-01-03') },
      ],
    });

    // VALE3: Buy 10 @ 100 => Pos 10, PM 100
    await prisma.assetOperation.create({
      data: { asset_id: vale3.id, telegram_id: telegramId, quantity: 10, unit_price: 100, type: 'BUY', date: new Date('2023-01-01') },
    });

    // 3. Mock Market API Responses
    (httpService.get as jest.Mock).mockImplementation((url: string) => {
        let price = 0;
        if (url.includes('PETR4')) price = 35;
        if (url.includes('VALE3')) price = 90;

        const response: Partial<AxiosResponse> = {
            data: {
                results: [{ regularMarketPrice: price }]
            }
        };
        return of(response);
    });

    // 4. Execute Service
    const result = await service.listUserInvestments(telegramId);

    // 5. Assertions
    // PETR4: Pos 15, PM 25, Price 35 => Profit (35-25)*15 = 150, Allocation 15*35 = 525
    // VALE3: Pos 10, PM 100, Price 90 => Profit (90-100)*10 = -100, Allocation 10*90 = 900
    // Totals: Profit 50, Allocation 1425

    expect(result.assets).toHaveLength(2);
    
    const petrResult = result.assets.find(a => a.ticker === 'PETR4');
    expect(petrResult).toMatchObject({
        position: 15,
        pm: 25,
        currentPrice: 35,
        profit: 150,
        allocation: 525
    });

    const valeResult = result.assets.find(a => a.ticker === 'VALE3');
    expect(valeResult).toMatchObject({
        position: 10,
        pm: 100,
        currentPrice: 90,
        profit: -100,
        allocation: 900
    });

    expect(result.totalProfit).toBe(50);
    expect(result.totalAllocation).toBe(1425);
  });

  it('should respect multi-tenancy and return only user specific investments', async () => {
    const otherUser = 999n;
    await prisma.user.create({ data: { telegram_id: otherUser } });

    const petr4 = await prisma.asset.create({
        data: { ticker: 'PETR4', type: 'STOCK' },
    });

    // My operations
    await prisma.assetOperation.create({
        data: { asset_id: petr4.id, telegram_id: telegramId, quantity: 10, unit_price: 20, type: 'BUY', date: new Date() },
    });

    // Other user's operations
    await prisma.assetOperation.create({
        data: { asset_id: petr4.id, telegram_id: otherUser, quantity: 50, unit_price: 10, type: 'BUY', date: new Date() },
    });

    (httpService.get as jest.Mock).mockReturnValue(of({ data: { results: [{ regularMarketPrice: 25 }] } }));

    const result = await service.listUserInvestments(telegramId);

    // Should only see my 10 PETR4
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].position).toBe(10);
  });
});
