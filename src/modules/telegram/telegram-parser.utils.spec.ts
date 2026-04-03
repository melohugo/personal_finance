import { parseGastoCommand } from './telegram-parser.utils';

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
      expect(() => parseGastoCommand('')).toThrow('Use o formato: /gasto <valor> <categoria>');
      expect(() => parseGastoCommand('50.5')).toThrow('Use o formato: /gasto <valor> <categoria>');
    });

    it('should throw error if amount is invalid', () => {
      expect(() => parseGastoCommand('abc Alimentação')).toThrow('Valor inválido. Por favor, envie um número.');
    });

    it('should handle multiple spaces between arguments', () => {
      const result = parseGastoCommand('  100.0   Viagem  ');
      expect(result).toEqual({
        amount: 100,
        categoryName: 'Viagem',
      });
    });
  });
});
