import Dexie, { Table } from 'dexie';
import { LogEntry, WeeklyTarget, FoodItem, WeightEntry, Recipe, MealTemplate, WaterLog } from './types/nutrition';

class NutritionDB extends Dexie {
  logs!: Table<LogEntry, string>;
  targets!: Table<WeeklyTarget, string>;
  foods!: Table<FoodItem, string>;
  weights!: Table<WeightEntry, string>;
  recipes!: Table<Recipe, string>;
  mealTemplates!: Table<MealTemplate, string>;
  waterLogs!: Table<WaterLog, string>;

  constructor() {
    super('NutritionAppDB');

    // Versiuni anterioare
    this.version(5).stores({
      logs: '&id, date, [date+mealType], loggedAt',
      targets: '&id, effectiveFrom',
      foods: '&id, &barcode, name',
      weights: '&date, loggedAt',
      recipes: '&id, name, createdAt',
    });

    this.version(6).stores({
      recipes: '&id, name, status, createdAt, updatedAt, *tags',
    }).upgrade(async (tx) => {
      await tx.table('recipes').toCollection().modify((recipe: Record<string, unknown>) => {
        if (!recipe.status) recipe.status = 'published';
        if (!Array.isArray(recipe.tags)) recipe.tags = [];
        if (!Array.isArray(recipe.steps)) recipe.steps = [];
        if (!recipe.servings) recipe.servings = 1;
        const now = (recipe.createdAt as number) || Date.now();
        if (!recipe.audit) {
          recipe.audit = {
            createdAt: now,
            updatedAt: now,
            timesLogged: 0,
          };
        }
      });
    });

    this.version(7).stores({
      logs: '&id, date, [date+mealType], loggedAt',
      mealTemplates: '&id, name, mealType, createdAt',
      waterLogs: '&date, updatedAt',
    }).upgrade(async (tx) => {
      await tx.table('logs').toCollection().modify((log: Record<string, unknown>) => {
        if (!log.status) log.status = 'consumed';
      });
    });

    // Versiunea 8: suport măsurători corporale și context pe weights
    this.version(8).stores({
      weights: '&date, loggedAt',
    }).upgrade(async (tx) => {
      await tx.table('weights').toCollection().modify((w: Record<string, unknown>) => {
        if (!w.context) w.context = 'fasted_morning';
      });
    });

    // Versiunea 9: indexare mealType pentru sugestii inteligente rapide
    this.version(9).stores({
      logs: '&id, date, mealType, [date+mealType], loggedAt',
    });
  }
}

export const db = new NutritionDB();
