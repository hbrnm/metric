export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodItem {
  id: string;
  barcode?: string;
  name: string;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  isCustom: boolean;
  createdAt: number;
}

export interface LogEntry {
  id: string;
  date: string;        // 'YYYY-MM-DD'
  mealType: MealType;
  foodId?: string;
  name: string;
  amountGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  loggedAt: number;
}

export interface WeightEntry {
  date: string;        // 'YYYY-MM-DD' — cheie unică per zi
  weightKg: number;
  trendWeight: number; // greutatea filtrată prin EMA
  loggedAt: number;
}

export interface RecipeIngredient {
  name: string;
  rawGrams: number;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  rawWeightTotal: number;
  cookedWeightTotal: number;
  caloriesPer100Cooked: number;
  proteinPer100Cooked: number;
  carbsPer100Cooked: number;
  fatPer100Cooked: number;
  createdAt: number;
}

export interface WeeklyTarget {
  id: string;
  effectiveFrom: string; // 'YYYY-MM-DD' — data de la care intră în vigoare
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
