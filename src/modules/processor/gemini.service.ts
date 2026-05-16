import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';

export interface ExtractedExpense {
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  description: string;
  isNewCategory: boolean;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    if (!apiKey) {
      this.logger.error(
        'GEMINI_API_KEY is not defined in environment variables',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async extractExpenseFromFile(
    fileUrl: string,
    mimeType: string,
    existingCategories: string[],
  ): Promise<ExtractedExpense[]> {
    this.logger.log(
      `Extracting expense from file: ${fileUrl} (Mime: ${mimeType})`,
    );

    let fileBase64: string;

    // 1. Download file with timeout
    try {
      const response = await axios.get<ArrayBuffer>(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 10000, // 10 seconds timeout
        family: 4, // Force IPv4 to avoid IPv6 resolution issues in Docker
      });
      const fileBuffer = Buffer.from(response.data);
      fileBase64 = fileBuffer.toString('base64');
    } catch (error) {
      this.logger.error(`Failed to download file from ${fileUrl}:`, error);
      throw new Error('Falha de rede ao baixar a imagem do Telegram.');
    }

    // 2. Call Gemini API
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const prompt = `
        Você é um assistente financeiro especializado em extração de dados de recibos e extratos bancários.
        Sua tarefa é extrair TODOS os gastos (débitos/compras) da imagem ou documento fornecido.
        
        Orientações:
        1. Identifique cada transação de saída (débito, compra, pagamento, pix enviado).
        2. IGNORE transações de entrada (depósitos, salários, pix recebido).
        3. Para cada gasto, extraia o valor total, a data e uma breve descrição.
        4. Categorize cada despesa. 
        5. Lista de categorias EXISTENTES do usuário: [${existingCategories.join(', ')}].
        6. Se a despesa se encaixar em uma existente, use-a EXATAMENTE como escrita.
        7. Se não servir, sugira uma NOVA categoria concisa em Português.
        8. Retorne APENAS um ARRAY de objetos JSON com a seguinte estrutura:
           [
             {
               "amount": number,
               "category": "string",
               "date": "YYYY-MM-DD",
               "description": "string",
               "isNewCategory": boolean
             }
           ]
        9. Se não encontrar uma data para um item, use a data atual: ${new Date().toISOString().split('T')[0]}.
        10. O idioma da descrição e das novas categorias deve ser Português.
      `;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType,
            data: fileBase64,
          },
        },
      ]);

      const textResponse = result.response.text();
      this.logger.debug(`Gemini Raw Response: ${textResponse}`);

      const extractedData = this.parseAndCleanJson(textResponse);

      // Ensure we always return an array
      if (Array.isArray(extractedData)) {
        return extractedData as ExtractedExpense[];
      }
      return [extractedData as ExtractedExpense];
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message?.includes(
          'A resposta da IA não está em um formato válido',
        )
      ) {
        throw error;
      }
      this.logger.error('Error during Gemini API processing:', error);
      throw new Error('Falha na comunicação com a API do Gemini.');
    }
  }

  private parseAndCleanJson(text: string): unknown {
    try {
      // Remove possible markdown code blocks
      const cleaned = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      this.logger.error(`Failed to parse JSON response: ${text}`);
      throw new Error('A resposta da IA não está em um formato válido.');
    }
  }
}
