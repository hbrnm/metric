import Dexie, { Table } from 'dexie';
import { LogEntry, WeeklyTarget, FoodItem, WeightEntry, Recipe } from './types/nutrition';

class NutritionDB extends Dexie {
  logs!: Table<LogEntry, string>;
  targets!: Table<WeeklyTarget, string>;
  foods!: Table<FoodItem, string>;
  weights!: Table<WeightEntry, string>;
  recipes!: Table<Recipe, string>;

  constructor() {
    super('NutritionAppDB');
    this.version(5).stores({
      logs: '&id, date, [date+mealType], loggedAt',
      targets: '&id, effectiveFrom',
      foods: '&id, &barcode, name',
      weights: '&date, loggedAt',
      recipes: '&id, name, createdAt',
    });
  }
}

export const db = new NutritionDB();
