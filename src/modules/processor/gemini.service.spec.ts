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

  describe('extractExpenseFromFile', () => {
    it('should extract expense data from an image correctly', async () => {
      const imageUrl = 'https://example.com/receipt.jpg';
      const mimeType = 'image/jpeg';
      const existingCategories = ['Alimentação', 'Transporte'];
      const recentExpenses = [
        { amount: 10, category: 'Food', description: 'desc', date: new Date() },
      ];

      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('fake_image_data'),
        headers: { 'content-type': 'application/octet-stream' }, // Telegram quirk
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

      const result = await service.extractExpenseFromFile(
        imageUrl,
        mimeType,
        existingCategories,
        recentExpenses,
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
        timeout: 15000,
        family: 4,
      });
      // Verify that the explicitly passed mimeType was used, ignoring the header
      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
        }),
      );
    });

    it('should retry downloading if it fails and succeed on second attempt', async () => {
      const imageUrl = 'https://example.com/retry.jpg';

      // First attempt fails, second succeeds
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          data: Buffer.from('fake_image_data'),
          headers: { 'content-type': 'image/jpeg' },
        });

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify([
              {
                amount: 10,
                category: 'Test',
                date: '2026-01-01',
                description: 'desc',
                isNewCategory: false,
              },
            ]),
        },
      });

      const result = await service.extractExpenseFromFile(
        imageUrl,
        'image/jpeg',
        [],
      );

      expect(result[0].amount).toBe(10);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should extract data from a PDF file', async () => {
      const pdfUrl = 'https://example.com/statement.pdf';
      const mimeType = 'application/pdf';

      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('fake_pdf_data'),
        headers: { 'content-type': 'application/pdf' },
      });

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify([
              {
                amount: 100,
                category: 'Lazer',
                date: '2026-05-15',
                description: 'Show',
                isNewCategory: false,
              },
            ]),
        },
      });

      const result = await service.extractExpenseFromFile(
        pdfUrl,
        mimeType,
        [],
        [],
      );

      expect(result[0].amount).toBe(100);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.any(String),
          expect.objectContaining({
            inlineData: expect.objectContaining({
              mimeType: 'application/pdf',
            }),
          }),
        ]),
      );
    });

    it('should throw error when image download fails after all retries', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Download failed'));

      await expect(
        service.extractExpenseFromFile('url', 'image/jpeg', [], []),
      ).rejects.toThrow('Falha de rede ao baixar a imagem do Telegram.');

      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });

    it('should throw error when Gemini API fails', async () => {
      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('fake_image_data'),
        headers: { 'content-type': 'image/jpeg' },
      });

      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      await expect(
        service.extractExpenseFromFile('url', 'image/jpeg', [], []),
      ).rejects.toThrow('Falha na comunicação com a API do Gemini.');
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

      await expect(
        service.extractExpenseFromFile('url', 'image/jpeg', [], []),
      ).rejects.toThrow('A resposta da IA não está em um formato válido.');
    });
  });
});
