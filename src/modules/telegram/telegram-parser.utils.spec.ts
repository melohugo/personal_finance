import {
  parseGastoCommand,
  parseListarCommand,
  parseDeletarCommand,
  parseEditarCommand,
  buildAiConfirmationMessage,
} from './telegram-parser.utils';

describe('TelegramParserUtils', () => {
  describe('buildAiConfirmationMessage', () => {
    it('should format the message and generate buttons correctly', () => {
      const expenses = [
        {
          amount: 50.5,
          category: 'Alimentação',
          date: '2026-05-20',
          description: 'Almoço',
          isNewCategory: false,
        },
        {
          amount: 100,
          category: 'Transporte',
          date: '2026-05-21',
          description: 'Gasolina',
          isNewCategory: true,
        },
      ];
      const pendingId = 'test-id';
      const result = buildAiConfirmationMessage(expenses, pendingId);

      expect(result.text).toContain('✅ *2 Despesas Identificadas!*');
      expect(result.text).toContain('1. 📅 20/05/2026 | 💰 R$ 50.50');
      expect(result.text).toContain('2. 📅 21/05/2026 | 💰 R$ 100.00');
      expect(result.text).toContain('Transporte ✨'); // New category indicator
      expect(result.text).toContain('📊 *Total Geral: R$ 150.50*');

      const buttons = result.keyboard.reply_markup.inline_keyboard;
      // Row 1: Edit buttons
      expect(buttons[0][0].text).toBe('✏️ Editar 1');
      expect(buttons[0][0].callback_data).toBe('edit_ai:test-id:0');
      expect(buttons[0][1].text).toBe('✏️ Editar 2');
      expect(buttons[0][1].callback_data).toBe('edit_ai:test-id:1');

      // Row 2: Confirm/Cancel buttons
      expect(buttons[1][0].text).toBe('Confirmar Todos ✅');
      expect(buttons[1][0].callback_data).toBe('conf_ai:test-id');
      expect(buttons[1][1].text).toBe('Descartar ❌');
      expect(buttons[1][1].callback_data).toBe('canc_ai:test-id');
    });
  });

  describe('parseGastoCommand', () => {
    it('should parse valid command with amount and category', () => {
      const result = parseGastoCommand('50.5 Alimentação');
      expect(result).toEqual({
        amount: 50.5,
        categoryName: 'Alimentacao',
      });
    });

    it('should normalize category name (accents, casing, spaces)', () => {
      expect(parseGastoCommand('10 alimentacao').categoryName).toBe(
        'Alimentacao',
      );
      expect(parseGastoCommand('10 ALIMENTAÇÃO').categoryName).toBe(
        'Alimentacao',
      );
      expect(parseGastoCommand('10   alimentação  ').categoryName).toBe(
        'Alimentacao',
      );
    });

    it('should parse valid command with commas in amount', () => {
      const result = parseGastoCommand('50,50 Mercado');
      expect(result).toEqual({
        amount: 50.5,
        categoryName: 'Mercado',
      });
    });

    it('should parse valid command with amount, category and specific date (DD/MM/YYYY)', () => {
      const result = parseGastoCommand('50.5 Alimentação 20/04/2026');
      expect(result).toEqual({
        amount: 50.5,
        categoryName: 'Alimentacao',
        date: new Date(2026, 3, 20),
      });
    });

    it('should parse valid command with amount, category and date (DD/MM)', () => {
      const currentYear = new Date().getFullYear();
      const result = parseGastoCommand('50.5 Alimentação 20/04');
      expect(result).toEqual({
        amount: 50.5,
        categoryName: 'Alimentacao',
        date: new Date(currentYear, 3, 20),
      });
    });

    it('should parse valid command with amount, category and day only (DD)', () => {
      const now = new Date();
      const result = parseGastoCommand('50.5 Alimentação 15');
      expect(result).toEqual({
        amount: 50.5,
        categoryName: 'Alimentacao',
        date: new Date(now.getFullYear(), now.getMonth(), 15),
      });
    });

    it('should handle category names with multiple words and a date', () => {
      const result = parseGastoCommand('100.0 Super Mercado 20/04/2026');
      expect(result).toEqual({
        amount: 100.0,
        categoryName: 'Super Mercado',
        date: new Date(2026, 3, 20),
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
      expect(result.range?.start.getMonth()).toBe(0);
      expect(result.range?.start.getFullYear()).toBe(currentYear);
    });

    it('should parse "/listar gastos 05/23" for specific month and year', () => {
      const result = parseListarCommand('gastos 05/23');
      expect(result.type).toBe('gastos');
      expect(result.range?.start.getMonth()).toBe(4);
      expect(result.range?.start.getFullYear()).toBe(2023);
    });

    it('should parse "/listar gastos jan mar" as a range', () => {
      const result = parseListarCommand('gastos jan mar');
      expect(result.type).toBe('gastos');
      expect(result.range?.start.getMonth()).toBe(0);
      expect(result.range?.end.getMonth()).toBe(2);
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

  describe('parseDeletarCommand', () => {
    const currentYear = new Date().getFullYear();

    it('should parse "/deletar gastos" for current month', () => {
      const result = parseDeletarCommand('gastos');
      expect(result.type).toBe('gastos');
      expect(result.range).toBeDefined();
      const now = new Date();
      expect(result.range?.start.getMonth()).toBe(now.getMonth());
    });

    it('should parse "/deletar categorias" and ignore extra arguments', () => {
      const result = parseDeletarCommand('categorias jan');
      expect(result.type).toBe('categorias');
      expect(result.range).toBeUndefined();
    });

    it('should parse "/deletar investimentos" for current month', () => {
      const result = parseDeletarCommand('investimentos');
      expect(result.type).toBe('investimentos');
      expect(result.range).toBeDefined();
    });

    it('should parse "/deletar gastos jan" for current year', () => {
      const result = parseDeletarCommand('gastos jan');
      expect(result.type).toBe('gastos');
      expect(result.range?.start.getMonth()).toBe(0);
      expect(result.range?.start.getFullYear()).toBe(currentYear);
    });

    it('should throw error for unknown type', () => {
      expect(() => parseDeletarCommand('qualquercoisa')).toThrow(
        'Tipo de exclusão inválido. Use: gastos, categorias ou investimentos.',
      );
    });
  });

  describe('parseEditarCommand', () => {
    const currentYear = new Date().getFullYear();

    it('should parse "gastos" for current month', () => {
      const result = parseEditarCommand('gastos');
      expect(result.type).toBe('gastos');
      expect(result.range).toBeDefined();
      const now = new Date();
      expect(result.range?.start.getMonth()).toBe(now.getMonth());
    });

    it('should parse "investimentos jan" for current year', () => {
      const result = parseEditarCommand('investimentos jan');
      expect(result.type).toBe('investimentos');
      expect(result.range?.start.getMonth()).toBe(0);
      expect(result.range?.start.getFullYear()).toBe(currentYear);
    });

    it('should parse "categorias" without range', () => {
      const result = parseEditarCommand('categorias');
      expect(result.type).toBe('categorias');
      expect(result.range).toBeUndefined();
    });

    it('should throw error for unknown type', () => {
      expect(() => parseEditarCommand('inválido')).toThrow(
        'Tipo de edição inválido. Use: gastos, categorias ou investimentos.',
      );
    });
  });
});
