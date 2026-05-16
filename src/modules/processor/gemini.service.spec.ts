/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { GeminiService } from './gemini.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock for GoogleGenerativeAI
const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => {
      return {
        getGenerativeModel: mockGetGenerativeModel,
      };
    }),
    SchemaType: {},
  };
});

describe('GeminiService', () => {
  let service: GeminiService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GEMINI_API_KEY') return 'test_key';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractExpenseFromImage', () => {
    it('should extract expense data correctly', async () => {
      const imageUrl = 'https://example.com/receipt.jpg';
      const existingCategories = ['Alimentação', 'Transporte'];

      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('fake_image_data'),
        headers: { 'content-type': 'image/jpeg' },
      });

      const mockResponseText = JSON.stringify([
        {
          amount: 25.5,
          category: 'Alimentação',
          date: '2026-05-11',
          description: 'Almoço',
          isNewCategory: false,
        },
      ]);

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => mockResponseText,
        },
      });

      const result = await service.extractExpenseFromImage(
        imageUrl,
        existingCategories,
      );

      expect(result).toEqual([
        {
          amount: 25.5,
          category: 'Alimentação',
          date: '2026-05-11',
          description: 'Almoço',
          isNewCategory: false,
        },
      ]);
      expect(mockedAxios.get).toHaveBeenCalledWith(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        family: 4,
      });
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
        }),
      );
    });

    it('should handle markdown JSON response', async () => {
      const imageUrl = 'https://example.com/receipt.jpg';
      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('fake_image_data'),
        headers: { 'content-type': 'image/jpeg' },
      });

      const mockResponseText =
        '```json\n[{\n  "amount": 10,\n  "category": "Lazer",\n  "date": "2026-05-11",\n  "description": "Cinema",\n  "isNewCategory": true\n}]\n```';

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => mockResponseText,
        },
      });

      const result = await service.extractExpenseFromImage(imageUrl, []);

      expect(result[0].amount).toBe(10);
      expect(result[0].category).toBe('Lazer');
    });

    it('should throw error when image download fails', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Download failed'));

      await expect(service.extractExpenseFromImage('url', [])).rejects.toThrow(
        'Falha de rede ao baixar a imagem do Telegram.',
      );
    });

    it('should throw error when Gemini API fails', async () => {
      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('fake_image_data'),
        headers: { 'content-type': 'image/jpeg' },
      });

      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      await expect(service.extractExpenseFromImage('url', [])).rejects.toThrow(
        'Falha na comunicação com a API do Gemini.',
      );
    });

    it('should throw error when Gemini returns invalid JSON', async () => {
      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('fake_image_data'),
        headers: { 'content-type': 'image/jpeg' },
      });

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Invalid JSON',
        },
      });

      await expect(service.extractExpenseFromImage('url', [])).rejects.toThrow(
        'A resposta da IA não está em um formato válido.',
      );
    });
  });
});
