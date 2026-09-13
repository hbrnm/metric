import { db } from '../db';
import { MealType, WeeklyTarget, FoodItem, Recipe } from '../types/nutrition';
import { computeNextEMA } from '../algorithms/metabolic';

const DEFAULT_TARGET: Omit<WeeklyTarget, 'id' | 'effectiveFrom'> = {
  calories: 2100,
  protein: 160,
  carbs: 190,
  fat: 65,
};

export async function addTarget(params: {
  effectiveFrom: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}) {
  if (params.calories <= 0) {
    throw new Error('Caloriile trebuie să fie un număr pozitiv.');
  }
  await db.targets.add({
    id: crypto.randomUUID(),
    ...params,
  });
}

export async function getActiveTarget(date: string): Promise<WeeklyTarget> {
  const candidates = await db.targets
    .where('effectiveFrom')
    .belowOrEqual(date)
    .toArray();

  if (candidates.length === 0) {
    return { id: 'default', effectiveFrom: date, ...DEFAULT_TARGET };
  }

  return candidates.reduce((latest, t) =>
    t.effectiveFrom > latest.effectiveFrom ? t : latest
  );
}

export async function addLogEntry(params: {
  date: string;
  mealType: MealType;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}) {
  if (!params.name.trim() || params.calories <= 0) {
    throw new Error('Nume și calorii valide sunt obligatorii.');
  }

  await db.logs.add({
    id: crypto.randomUUID(),
    date: params.date,
    mealType: params.mealType,
    name: params.name.trim(),
    amountGrams: 1,
    calories: Math.round(params.calories),
    protein: params.protein ?? 0,
    carbs: params.carbs ?? 0,
    fat: params.fat ?? 0,
    loggedAt: Date.now(),
  });
}

export async function deleteLogEntry(id: string) {
  await db.logs.delete(id);
}

export async function logWeightEntry(date: string, weightKg: number) {
  if (weightKg <= 20 || weightKg >= 300) {
    throw new Error('Introdu o greutate validă (între 20 și 300 kg).');
  }

  const previous = await db.weights
    .where('date')
    .below(date)
    .last();

  const trendWeight = computeNextEMA(weightKg, previous?.trendWeight);

  await db.weights.put({
    date,
    weightKg,
    trendWeight,
    loggedAt: Date.now(),
  });
}

export async function saveRecipe(params: {
  name: string;
  ingredients: { name: string; rawGrams: number; caloriesPer100: number; proteinPer100: number; carbsPer100: number; fatPer100: number }[];
  cookedWeightTotal: number;
}) {
  if (!params.name.trim() || params.ingredients.length === 0) {
    throw new Error('Rețeta are nevoie de nume și cel puțin un ingredient.');
  }
  const rawWeightTotal = params.ingredients.reduce((s, i) => s + i.rawGrams, 0);
  if (params.cookedWeightTotal <= 0) {
    throw new Error('Greutatea gătită trebuie să fie pozitivă.');
  }

  const totalCalories = params.ingredients.reduce((s, i) => s + i.caloriesPer100 * (i.rawGrams / 100), 0);
  const totalProtein = params.ingredients.reduce((s, i) => s + i.proteinPer100 * (i.rawGrams / 100), 0);
  const totalCarbs = params.ingredients.reduce((s, i) => s + i.carbsPer100 * (i.rawGrams / 100), 0);
  const totalFat = params.ingredients.reduce((s, i) => s + i.fatPer100 * (i.rawGrams / 100), 0);

  const ratio = 100 / params.cookedWeightTotal;

  const recipe: Recipe = {
    id: crypto.randomUUID(),
    name: params.name.trim(),
    ingredients: params.ingredients,
    rawWeightTotal,
    cookedWeightTotal: params.cookedWeightTotal,
    caloriesPer100Cooked: Math.round(totalCalories * ratio),
    proteinPer100Cooked: Math.round(totalProtein * ratio * 10) / 10,
    carbsPer100Cooked: Math.round(totalCarbs * ratio * 10) / 10,
    fatPer100Cooked: Math.round(totalFat * ratio * 10) / 10,
    createdAt: Date.now(),
  };

  await db.recipes.add(recipe);
  return recipe;
}

export async function logRecipeByGrams(params: {
  date: string;
  mealType: MealType;
  recipe: Recipe;
  grams: number;
}) {
  if (params.grams <= 0) {
    throw new Error('Gramajul trebuie să fie pozitiv.');
  }
  const ratio = params.grams / 100;

  await db.logs.add({
    id: crypto.randomUUID(),
    date: params.date,
    mealType: params.mealType,
    name: params.recipe.name,
    amountGrams: params.grams,
    calories: Math.round(params.recipe.caloriesPer100Cooked * ratio),
    protein: Math.round(params.recipe.proteinPer100Cooked * ratio * 10) / 10,
    carbs: Math.round(params.recipe.carbsPer100Cooked * ratio * 10) / 10,
    fat: Math.round(params.recipe.fatPer100Cooked * ratio * 10) / 10,
    loggedAt: Date.now(),
  });
}
export async function logFoodByGrams(params: {
  date: string;
  mealType: MealType;
  food: FoodItem;
  grams: number;
}) {
  if (params.grams <= 0) {
    throw new Error('Gramajul trebuie să fie pozitiv.');
  }
  const ratio = params.grams / 100;

  await db.logs.add({
    id: crypto.randomUUID(),
    date: params.date,
    mealType: params.mealType,
    foodId: params.food.id,
    name: params.food.name,
    amountGrams: params.grams,
    calories: Math.round(params.food.caloriesPer100 * ratio),
    protein: Math.round(params.food.proteinPer100 * ratio * 10) / 10,
    carbs: Math.round(params.food.carbsPer100 * ratio * 10) / 10,
    fat: Math.round(params.food.fatPer100 * ratio * 10) / 10,
    loggedAt: Date.now(),
  });
}
