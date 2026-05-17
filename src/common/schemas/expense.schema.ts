export interface ExtractedExpense {
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  description: string;
  isNewCategory: boolean;
}
