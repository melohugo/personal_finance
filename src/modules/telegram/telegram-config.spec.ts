import { ConfigService } from '@nestjs/config';
import { session } from 'telegraf';

describe('Telegram Configuration Logic', () => {
  const getTelegrafOptions = (baseUrl?: string, secretToken?: string) => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return '123:abc';
        if (key === 'BASE_URL') return baseUrl;
        if (key === 'TELEGRAM_WEBHOOK_SECRET') return secretToken;
        return undefined;
      }),
    } as unknown as ConfigService;

    // Simula a factory do AppModule
    const token = configService.get<string>('TELEGRAM_BOT_TOKEN');
    const url = configService.get<string>('BASE_URL');

    if (!token || !url) {
      throw new Error(
        'TELEGRAM_BOT_TOKEN e BASE_URL são obrigatórios para o funcionamento do Webhook.',
      );
    }

    return {
      token,
      path: '/telegraf-webhook',
      middlewares: [session()],
    };
  };

  it('should return Webhook options when BASE_URL is present', () => {
    const options = getTelegrafOptions(
      'https://test-app.render.com',
      'super-secret',
    );

    expect(options.path).toBe('/telegraf-webhook');
    expect((options as any).launchOptions).toBeUndefined();
  });

  it('should throw error when BASE_URL is absent', () => {
    expect(() => getTelegrafOptions(undefined)).toThrow(
      'TELEGRAM_BOT_TOKEN e BASE_URL são obrigatórios para o funcionamento do Webhook.',
    );
  });
});
