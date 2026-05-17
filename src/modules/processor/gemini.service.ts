import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { ExtractedExpense } from '../../common/schemas/expense.schema';

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
    recentExpenses: any[] = [],
  ): Promise<ExtractedExpense[]> {
    this.logger.log(
      `Extracting expense from file: ${fileUrl} (Mime: ${mimeType})`,
    );

    let fileBuffer: Buffer | null = null;
    const maxRetries = 3;
    const timeout = 15000; // 15 seconds

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get<ArrayBuffer>(fileUrl, {
          responseType: 'arraybuffer',
          timeout,
          family: 4,
        });
        fileBuffer = Buffer.from(response.data);
        break;
      } catch (error) {
        this.logger.warn(
          `Attempt ${i + 1} failed to download file from ${fileUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        if (i === maxRetries - 1) {
          this.logger.error(
            `Failed to download file after ${maxRetries} attempts.`,
          );
          throw new Error('Falha de rede ao baixar a imagem do Telegram.');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay
      }
    }

    if (!fileBuffer) {
      throw new Error('Falha ao processar o arquivo baixado.');
    }

    const fileBase64 = fileBuffer.toString('base64');

    // 2. Call Gemini API
    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const historyContext =
        recentExpenses.length > 0
          ? `Aqui estão os últimos gastos do usuário para você entender o padrão de categorização e nomes:\n${JSON.stringify(recentExpenses, null, 2)}\nUse esse histórico para manter a consistência nas novas categorias.`
          : '';

      const prompt = `
        Você é um assistente financeiro especializado em extração de dados de recibos e extratos bancários.
        Sua tarefa é extrair TODOS os gastos (débitos/compras) da imagem ou documento fornecido.
        
        Orientações:
        1. Identifique cada transação de saída (débito, compra, pagamento, pix enviado).
        2. IGNORE transações de entrada (depósitos, salários, pix recebido).
        3. Para cada gasto, extraia o valor total, a data e uma breve descrição.
        4. Categorize cada despesa. 
        5. Lista de categorias EXISTENTES do usuário: [${existingCategories.join(', ')}].
        6. ${historyContext}
        7. Se a despesa se encaixar em uma existente ou sugerida pelo histórico, use-a EXATAMENTE como escrita.
        8. Se não servir, sugira uma NOVA categoria concisa em Português.
        9. Retorne APENAS um ARRAY de objetos JSON com a seguinte estrutura:
           [
             {
               "amount": number,
               "category": "string",
               "date": "YYYY-MM-DD",
               "description": "string",
               "isNewCategory": boolean
             }
           ]
        10. Se não encontrar uma data para um item, use a data atual: ${new Date().toISOString().split('T')[0]}.
        11. O idioma da descrição e das novas categorias deve ser Português.
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
