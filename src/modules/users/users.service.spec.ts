import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrCreateUser', () => {
    const telegramId = 123456789n;
    const mockUser = { telegram_id: telegramId, created_at: new Date() };

    it('should successfully upsert a user', async () => {
      mockPrismaService.user.upsert.mockResolvedValue(mockUser);

      const result = await service.getOrCreateUser(telegramId);

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { telegram_id: telegramId },
        update: {},
        create: { telegram_id: telegramId },
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw an error if database fails', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaService.user.upsert.mockRejectedValue(dbError);

      await expect(service.getOrCreateUser(telegramId)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });
});
