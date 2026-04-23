import { ConfigService } from '@nestjs/config';
import { session } from 'telegraf';

// Teste focado na lógica de construção das opções do TelegrafModule
describe('Telegram Configuration Logic', () => {
  const getTelegrafOptions = (baseUrl?: string) => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return '123:abc';
        if (key === 'BASE_URL') return baseUrl;
        return undefined;
      }),
    } as unknown as ConfigService;

    // Simula a factory do AppModule
    const token = configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    const url = configService.get<string>('BASE_URL');

    return {
      token,
      middlewares: [session()],
      launchOptions: url
        ? {
            webhook: {
              domain: url,
              hookPath: '/telegraf',
            },
          }
        : undefined,
    };
  };

  it('should return Webhook options when BASE_URL is present', () => {
    const options = getTelegrafOptions('https://test-app.render.com');

    expect(options.launchOptions).toBeDefined();
    expect(options.launchOptions?.webhook).toBeDefined();
    expect(options.launchOptions?.webhook?.domain).toBe(
      'https://test-app.render.com',
    );
  });

  it('should return undefined launchOptions (Polling) when BASE_URL is absent', () => {
    const options = getTelegrafOptions(undefined);

    expect(options.launchOptions).toBeUndefined();
  });
});
