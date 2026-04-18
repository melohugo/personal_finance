export function parseGastoCommand(args: string): {
  amount: number;
  categoryName: string;
} {
  const parts = args.trim().split(/\s+/);

  if (parts.length < 2) {
    throw new Error('Use o formato: /gasto <valor> <categoria>');
  }

  const amountStr = parts[0].replace(',', '.');
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || !isFinite(amount)) {
    throw new Error('Valor inválido. Por favor, envie um número.');
  }

  const categoryName = parts.slice(1).join(' ');

  return { amount, categoryName };
}

export type ListarType = 'gastos' | 'categorias' | 'investimentos';

export interface ListarCommandResult {
  type: ListarType;
  range?: {
    start: Date;
    end: Date;
  };
}

export type DeletarCommandResult = ListarCommandResult;

const MONTHS_MAP: Record<string, number> = {
  jan: 0,
  janeiro: 0,
  fev: 1,
  fevereiro: 1,
  mar: 2,
  março: 2,
  abr: 3,
  abril: 3,
  mai: 4,
  maio: 4,
  jun: 5,
  junho: 5,
  jul: 6,
  julho: 6,
  ago: 7,
  agosto: 7,
  set: 8,
  setembro: 8,
  out: 9,
  outubro: 9,
  nov: 10,
  novembro: 10,
  dez: 11,
  dezembro: 11,
};

function parseDate(dateStr: string): Date {
  const now = new Date();
  const cleaned = dateStr.toLowerCase().trim();

  // Caso 1: Nome do mês (ex: jan, janeiro)
  if (MONTHS_MAP[cleaned] !== undefined) {
    return new Date(now.getFullYear(), MONTHS_MAP[cleaned], 1);
  }

  // Caso 2: Formato numérico (ex: 01/24, 1/2024, 05/23)
  const numericMatch = cleaned.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1], 10) - 1;
    let year = parseInt(numericMatch[2], 10);

    if (year < 100) {
      year += 2000;
    }

    if (month < 0 || month > 11) {
      throw new Error(`Mês inválido: ${dateStr}`);
    }

    return new Date(year, month, 1);
  }

  throw new Error(`Mês inválido: ${dateStr}`);
}

export function parseListarCommand(args: string): ListarCommandResult {
  const parts = args.trim().toLowerCase().split(/\s+/);
  const type = parts[0] as ListarType;

  if (!['gastos', 'categorias', 'investimentos'].includes(type)) {
    throw new Error(
      'Tipo de listagem inválido. Use: gastos, categorias ou investimentos.',
    );
  }

  if (type !== 'gastos') {
    return { type };
  }

  // Para gastos, processar datas
  const now = new Date();
  const dateArgs = parts.slice(1);

  if (dateArgs.length === 0) {
    // Mês atual
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { type, range: { start, end } };
  }

  if (dateArgs.length === 1) {
    const start = parseDate(dateArgs[0]);
    const end = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { type, range: { start, end } };
  }

  // Intervalo
  const start = parseDate(dateArgs[0]);
  const endLimit = parseDate(dateArgs[1]);
  const end = new Date(
    endLimit.getFullYear(),
    endLimit.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  return { type, range: { start, end } };
}

export function parseDeletarCommand(args: string): DeletarCommandResult {
  const parts = args.trim().toLowerCase().split(/\s+/);
  const type = parts[0] as ListarType;

  if (!['gastos', 'categorias', 'investimentos'].includes(type)) {
    throw new Error(
      'Tipo de exclusão inválido. Use: gastos, categorias ou investimentos.',
    );
  }

  if (type === 'categorias') {
    return { type };
  }

  const now = new Date();
  const dateArgs = parts.slice(1);

  if (dateArgs.length === 0) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { type, range: { start, end } };
  }

  const start = parseDate(dateArgs[0]);
  const end = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  return { type, range: { start, end } };
}

export function parseEditarCommand(args: string): ListarCommandResult {
  const parts = args.trim().toLowerCase().split(/\s+/);
  const type = parts[0] as ListarType;

  if (!['gastos', 'categorias', 'investimentos'].includes(type)) {
    throw new Error(
      'Tipo de edição inválido. Use: gastos, categorias ou investimentos.',
    );
  }

  if (type === 'categorias') {
    return { type };
  }

  const now = new Date();
  const dateArgs = parts.slice(1);

  if (dateArgs.length === 0) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { type, range: { start, end } };
  }

  const start = parseDate(dateArgs[0]);
  const end = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  return { type, range: { start, end } };
}
