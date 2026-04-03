export function parseGastoCommand(args: string): { amount: number; categoryName: string } {
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
