import { parseGastoCommand, parseListarCommand } from './telegram-parser.utils';

describe('TelegramParserUtils', () => {
  describe('parseGastoCommand', () => {
    it('should parse valid command with amount and category', () => {
      const result = parseGastoCommand('50.5 Alimentação');
      expect(result).toEqual({
        amount: 50.5,
        categoryName: 'Alimentação',
      });
    });

    it('should parse valid command with commas in amount', () => {
      const result = parseGastoCommand('50,50 Mercado');
      expect(result).toEqual({
        amount: 50.5,
        categoryName: 'Mercado',
      });
    });

    it('should throw error if arguments are missing', () => {
      expect(() => parseGastoCommand('')).toThrow(
        'Use o formato: /gasto <valor> <categoria>',
      );
      expect(() => parseGastoCommand('50.5')).toThrow(
        'Use o formato: /gasto <valor> <categoria>',
      );
    });

    it('should throw error if amount is invalid', () => {
      expect(() => parseGastoCommand('abc Alimentação')).toThrow(
        'Valor inválido. Por favor, envie um número.',
      );
    });

    it('should handle multiple spaces between arguments', () => {
      const result = parseGastoCommand('  100.0   Viagem  ');
      expect(result).toEqual({
        amount: 100,
        categoryName: 'Viagem',
      });
    });
  });

  describe('parseListarCommand', () => {
    const currentYear = new Date().getFullYear();

    it('should parse "/listar gastos" for current month', () => {
      const result = parseListarCommand('gastos');
      expect(result.type).toBe('gastos');
      expect(result.range).toBeDefined();
      // Verificamos se o início é o primeiro dia do mês atual
      const now = new Date();
      expect(result.range?.start.getMonth()).toBe(now.getMonth());
      expect(result.range?.start.getDate()).toBe(1);
    });

    it('should parse "/listar categorias"', () => {
      const result = parseListarCommand('categorias');
      expect(result.type).toBe('categorias');
    });

    it('should parse "/listar investimentos"', () => {
      const result = parseListarCommand('investimentos');
      expect(result.type).toBe('investimentos');
    });

    it('should parse "/listar gastos jan" for current year', () => {
      const result = parseListarCommand('gastos jan');
      expect(result.type).toBe('gastos');
      expect(result.range?.start.getMonth()).toBe(0); // Janeiro
      expect(result.range?.start.getFullYear()).toBe(currentYear);
    });

    it('should parse "/listar gastos 05/23" for specific month and year', () => {
      const result = parseListarCommand('gastos 05/23');
      expect(result.type).toBe('gastos');
      expect(result.range?.start.getMonth()).toBe(4); // Maio
      expect(result.range?.start.getFullYear()).toBe(2023);
    });

    it('should parse "/listar gastos jan mar" as a range', () => {
      const result = parseListarCommand('gastos jan mar');
      expect(result.type).toBe('gastos');
      expect(result.range?.start.getMonth()).toBe(0); // Janeiro
      expect(result.range?.end.getMonth()).toBe(2); // Março (fim do mês será tratado no service)
    });

    it('should throw error for unknown type', () => {
      expect(() => parseListarCommand('qualquercoisa')).toThrow(
        'Tipo de listagem inválido. Use: gastos, categorias ou investimentos.',
      );
    });

    it('should throw error for invalid month name', () => {
      expect(() => parseListarCommand('gastos xpto')).toThrow(
        'Mês inválido: xpto',
      );
    });

    it('should throw error for invalid date format', () => {
      expect(() => parseListarCommand('gastos 13/2024')).toThrow(
        'Mês inválido: 13/2024',
      );
    });
  });
});
