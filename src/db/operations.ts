import { db } from '../db';
import {
  MealType,
  WeeklyTarget,
  FoodItem,
  Recipe,
  RecipeIngredient,
  RecipeStep,
  RecipeStatus,
  RecipeCategory,
  LogEntry,
  LogEntryStatus,
  MealTemplate,
  WeightMeasurementContext,
} from '../types/nutrition';
import { computeNextEMA } from '../algorithms/metabolic';

import { SEED_ROMANIAN_FOODS } from '../data/seedFoodsRo';

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
  const calories = Math.round(Number(params.calories));
  const protein = Math.round(Number(params.protein) * 10) / 10;
  const carbs = Math.round(Number(params.carbs) * 10) / 10;
  const fat = Math.round(Number(params.fat) * 10) / 10;

  if (!Number.isFinite(calories) || calories <= 0) {
    throw new Error('Caloriile trebuie să fie un număr pozitiv.');
  }

  const existing = await db.targets.where('effectiveFrom').equals(params.effectiveFrom).first();

  if (existing) {
    await db.targets.update(existing.id, {
      calories,
      protein: Number.isFinite(protein) && protein >= 0 ? protein : 0,
      carbs: Number.isFinite(carbs) && carbs >= 0 ? carbs : 0,
      fat: Number.isFinite(fat) && fat >= 0 ? fat : 0,
    });
  } else {
    await db.targets.add({
      id: crypto.randomUUID(),
      effectiveFrom: params.effectiveFrom,
      calories,
      protein: Number.isFinite(protein) && protein >= 0 ? protein : 0,
      carbs: Number.isFinite(carbs) && carbs >= 0 ? carbs : 0,
      fat: Number.isFinite(fat) && fat >= 0 ? fat : 0,
    });
  }
}

export async function deleteTarget(id: string) {
  await db.targets.delete(id);
}

/**
 * Încarcă automat alimentele de bază și mâncărurile tradiționale românești dacă tabela foods este goală.
 */
export async function seedInitialFoodsIfNeeded(): Promise<number> {
  const count = await db.foods.count();
  if (count > 0) return 0;

  const now = Date.now();
  const items: FoodItem[] = SEED_ROMANIAN_FOODS.map((f) => ({
    ...f,
    id: crypto.randomUUID(),
    createdAt: now,
  }));

  await db.foods.bulkPut(items);
  return items.length;
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
  status?: LogEntryStatus;
  notes?: string;
  timeOfDay?: string;
  foodId?: string;
  recipeId?: string;
  amountGrams?: number;
}) {
  const name = params.name.trim();
  const calories = Math.round(Number(params.calories));
  const protein = Math.round(Number(params.protein ?? 0) * 10) / 10;
  const carbs = Math.round(Number(params.carbs ?? 0) * 10) / 10;
  const fat = Math.round(Number(params.fat ?? 0) * 10) / 10;

  if (!name) {
    throw new Error('Numele alimentului este obligatoriu.');
  }
  if (!Number.isFinite(calories) || calories <= 0) {
    throw new Error('Caloriile trebuie să fie un număr pozitiv valid.');
  }

  await db.logs.add({
    id: crypto.randomUUID(),
    date: params.date,
    mealType: params.mealType,
    status: params.status || 'consumed',
    foodId: params.foodId,
    recipeId: params.recipeId,
    name,
    amountGrams: params.amountGrams ?? 1,
    calories,
    protein: Number.isFinite(protein) && protein >= 0 ? protein : 0,
    carbs: Number.isFinite(carbs) && carbs >= 0 ? carbs : 0,
    fat: Number.isFinite(fat) && fat >= 0 ? fat : 0,
    notes: params.notes,
    timeOfDay: params.timeOfDay,
    loggedAt: Date.now(),
  });
}

export async function updateLogEntry(id: string, updates: Partial<LogEntry>) {
  await db.logs.update(id, updates);
}

export async function toggleLogEntryStatus(id: string, currentStatus: LogEntryStatus) {
  const nextStatus: LogEntryStatus = currentStatus === 'consumed' ? 'planned' : 'consumed';
  await db.logs.update(id, { status: nextStatus });
}

export async function deleteLogEntry(id: string) {
  await db.logs.delete(id);
}

export async function bulkDeleteLogs(ids: string[]) {
  await db.transaction('rw', db.logs, async () => {
    for (const id of ids) {
      await db.logs.delete(id);
    }
  });
}

export interface FrequentFoodSuggestion {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  amountGrams?: number;
  foodId?: string;
  recipeId?: string;
  count: number;
}

/**
 * Analizează ultimele logări pentru o anumită masă și extrage cele mai frecvente alimente.
 */
export async function getFrequentFoodsForMeal(
  mealType: MealType,
  limit = 4
): Promise<FrequentFoodSuggestion[]> {
  const entries = await db.logs
    .where('mealType')
    .equals(mealType)
    .reverse()
    .limit(100)
    .toArray();

  if (entries.length === 0) return [];

  const groupMap = new Map<
    string,
    {
      originalName: string;
      foodId?: string;
      recipeId?: string;
      totalCalories: number;
      totalProtein: number;
      totalCarbs: number;
      totalFat: number;
      totalGrams: number;
      hasGramsCount: number;
      count: number;
      lastLoggedAt: number;
    }
  >();

  for (const entry of entries) {
    const key = entry.name.trim().toLowerCase();
    if (!key) continue;

    const existing = groupMap.get(key);
    if (!existing) {
      groupMap.set(key, {
        originalName: entry.name.trim(),
        foodId: entry.foodId,
        recipeId: entry.recipeId,
        totalCalories: entry.calories,
        totalProtein: entry.protein,
        totalCarbs: entry.carbs,
        totalFat: entry.fat,
        totalGrams: entry.amountGrams || 0,
        hasGramsCount: entry.amountGrams ? 1 : 0,
        count: 1,
        lastLoggedAt: entry.loggedAt || 0,
      });
    } else {
      existing.count += 1;
      existing.totalCalories += entry.calories;
      existing.totalProtein += entry.protein;
      existing.totalCarbs += entry.carbs;
      existing.totalFat += entry.fat;
      if (entry.amountGrams) {
        existing.totalGrams += entry.amountGrams;
        existing.hasGramsCount += 1;
      }
      if (entry.loggedAt && entry.loggedAt > existing.lastLoggedAt) {
        existing.lastLoggedAt = entry.loggedAt;
        existing.originalName = entry.name.trim();
      }
    }
  }

  const sorted = Array.from(groupMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.lastLoggedAt - a.lastLoggedAt;
  });

  return sorted.slice(0, limit).map((item) => ({
    name: item.originalName,
    calories: Math.round(item.totalCalories / item.count),
    protein: Math.round((item.totalProtein / item.count) * 10) / 10,
    carbs: Math.round((item.totalCarbs / item.count) * 10) / 10,
    fat: Math.round((item.totalFat / item.count) * 10) / 10,
    amountGrams: item.hasGramsCount > 0 ? Math.round(item.totalGrams / item.hasGramsCount) : undefined,
    foodId: item.foodId,
    recipeId: item.recipeId,
    count: item.count,
  }));
}

export async function bulkMoveLogs(ids: string[], targetMeal: MealType) {
  await db.transaction('rw', db.logs, async () => {
    for (const id of ids) {
      await db.logs.update(id, { mealType: targetMeal });
    }
  });
}

/**
 * Copiază toate alimentele dintr-o masă a unei zile în altă zi/masă.
 */
export async function copyMealToDate(sourceDate: string, sourceMeal: MealType, targetDate: string, targetMeal?: MealType) {
  const items = await db.logs
    .where('[date+mealType]')
    .equals([sourceDate, sourceMeal])
    .toArray();

  if (items.length === 0) return 0;

  const destMeal = targetMeal || sourceMeal;
  const now = Date.now();

  await db.transaction('rw', db.logs, async () => {
    for (const item of items) {
      await db.logs.add({
        ...item,
        id: crypto.randomUUID(),
        date: targetDate,
        mealType: destMeal,
        status: 'consumed',
        loggedAt: now,
      });
    }
  });

  return items.length;
}

/**
 * Copiază toate mesele dintr-o zi întreagă într-o altă zi.
 */
export async function copyFullDayToDate(sourceDate: string, targetDate: string) {
  const items = await db.logs.where('date').equals(sourceDate).toArray();
  if (items.length === 0) return 0;

  const now = Date.now();
  await db.transaction('rw', db.logs, async () => {
    for (const item of items) {
      await db.logs.add({
        ...item,
        id: crypto.randomUUID(),
        date: targetDate,
        status: 'consumed',
        loggedAt: now,
      });
    }
  });

  return items.length;
}

/**
 * Salvează o masă existentă ca șablon reutilizabil.
 */
export async function saveMealAsTemplate(name: string, mealType: MealType, items: LogEntry[]): Promise<MealTemplate> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Numele șablonului este obligatoriu.');
  if (items.length === 0) throw new Error('Masa trebuie să aibă cel puțin un aliment.');

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  const templateItems = items.map((i) => {
    totalCalories += i.calories;
    totalProtein += i.protein;
    totalCarbs += i.carbs;
    totalFat += i.fat;
    return {
      name: i.name,
      amountGrams: i.amountGrams,
      calories: i.calories,
      protein: i.protein,
      carbs: i.carbs,
      fat: i.fat,
      foodId: i.foodId,
      recipeId: i.recipeId,
    };
  });

  const template: MealTemplate = {
    id: crypto.randomUUID(),
    name: trimmedName,
    mealType,
    items: templateItems,
    totalCalories: Math.round(totalCalories),
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
    createdAt: Date.now(),
  };

  await db.mealTemplates.add(template);
  return template;
}

/**
 * Loghează instant un întreg șablon de masă în jurnalul zilnic.
 */
export async function logMealTemplate(template: MealTemplate, date: string, mealType: MealType) {
  const now = Date.now();
  await db.transaction('rw', db.logs, async () => {
    for (const item of template.items) {
      await db.logs.add({
        id: crypto.randomUUID(),
        date,
        mealType,
        status: 'consumed',
        foodId: item.foodId,
        recipeId: item.recipeId,
        name: item.name,
        amountGrams: item.amountGrams,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        loggedAt: now,
      });
    }
  });
}

export async function deleteMealTemplate(id: string) {
  await db.mealTemplates.delete(id);
}

/**
 * Urmărire apă și hidratare
 */
export async function logWater(date: string, deltaMl: number, targetMl = 2500) {
  await db.transaction('rw', db.waterLogs, async () => {
    const existing = await db.waterLogs.get(date);
    const currentMl = existing ? existing.milliliters : 0;
    const newMl = Math.max(0, currentMl + deltaMl);

    await db.waterLogs.put({
      date,
      milliliters: newMl,
      targetMl: existing?.targetMl || targetMl,
      updatedAt: Date.now(),
    });
  });
}

/**
 * Export jurnal în format CSV pe un interval de date.
 */
export async function generateCsvExport(startDate: string, endDate: string): Promise<string> {
  const logs = await db.logs
    .where('date')
    .between(startDate, endDate, true, true)
    .sortBy('date');

  const headers = ['Data', 'Masa', 'Status', 'Aliment', 'Gramaj (g)', 'Calorii (kcal)', 'Proteine (g)', 'Carbohidrati (g)', 'Grasimi (g)'];
  const rows = logs.map((l) => [
    l.date,
    l.mealType,
    l.status,
    `"${l.name.replace(/"/g, '""')}"`,
    l.amountGrams,
    l.calories,
    l.protein,
    l.carbs,
    l.fat,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  return csvContent;
}

export async function logWeightEntry(
  date: string,
  rawWeightKg: number,
  options?: {
    bodyFatPercent?: number;
    waistCm?: number;
    hipsCm?: number;
    context?: WeightMeasurementContext;
    notes?: string;
  }
) {
  const weightKg = Math.round(Number(rawWeightKg) * 10) / 10;

  if (!Number.isFinite(weightKg) || weightKg <= 20 || weightKg >= 300) {
    throw new Error('Introdu o greutate validă (între 20 și 300 kg).');
  }

  const bodyFatPercent = options?.bodyFatPercent && Number.isFinite(options.bodyFatPercent) ? Math.round(options.bodyFatPercent * 10) / 10 : undefined;
  const waistCm = options?.waistCm && Number.isFinite(options.waistCm) ? Math.round(options.waistCm * 10) / 10 : undefined;
  const hipsCm = options?.hipsCm && Number.isFinite(options.hipsCm) ? Math.round(options.hipsCm * 10) / 10 : undefined;

  await db.transaction('rw', db.weights, async () => {
    const previous = await db.weights.where('date').below(date).last();
    const trendWeight = computeNextEMA(weightKg, previous?.trendWeight);

    await db.weights.put({
      date,
      weightKg,
      trendWeight,
      bodyFatPercent,
      waistCm,
      hipsCm,
      context: options?.context || 'fasted_morning',
      notes: options?.notes?.trim() || undefined,
      loggedAt: Date.now(),
    });

    const subsequent = await db.weights.where('date').above(date).sortBy('date');
    let runningTrend = trendWeight;
    for (const entry of subsequent) {
      runningTrend = computeNextEMA(entry.weightKg, runningTrend);
      await db.weights.update(entry.date, { trendWeight: runningTrend });
    }
  });
}

/**
 * Export istoric greutate în format CSV.
 */
export async function generateWeightCsvExport(): Promise<string> {
  const weights = await db.weights.orderBy('date').toArray();
  const headers = ['Data', 'Greutate (kg)', 'Trend EMA (kg)', 'Grasime (%)', 'Talie (cm)', 'Solduri (cm)', 'Context', 'Note'];
  const rows = weights.map((w) => [
    w.date,
    w.weightKg,
    w.trendWeight,
    w.bodyFatPercent ?? '',
    w.waistCm ?? '',
    w.hipsCm ?? '',
    w.context ?? 'fasted_morning',
    `"${(w.notes || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export async function deleteWeightEntry(date: string) {
  await db.transaction('rw', db.weights, async () => {
    await db.weights.delete(date);

    const previous = await db.weights.where('date').below(date).last();
    let runningTrend: number | undefined = previous?.trendWeight;

    const subsequent = await db.weights.where('date').above(date).sortBy('date');
    for (const entry of subsequent) {
      runningTrend = computeNextEMA(entry.weightKg, runningTrend);
      await db.weights.update(entry.date, { trendWeight: runningTrend });
    }
  });
}

export async function saveRecipe(params: {
  name: string;
  status?: RecipeStatus;
  category?: RecipeCategory;
  tags?: string[];
  ingredients: RecipeIngredient[];
  steps?: RecipeStep[];
  servings?: number;
  cookedWeightTotal: number;
  sourceUrl?: string;
  notes?: string;
}) {
  const name = params.name.trim();
  if (!name) throw new Error('Numele rețetei este obligatoriu.');
  if (!params.ingredients || params.ingredients.length === 0) {
    throw new Error('Rețeta are nevoie de cel puțin un ingredient.');
  }

  const rawWeightTotal = params.ingredients.reduce((s, i) => s + (Number.isFinite(i.rawGrams) ? i.rawGrams : 0), 0);
  const cookedWeightTotal = Number(params.cookedWeightTotal);

  if (!Number.isFinite(cookedWeightTotal) || cookedWeightTotal <= 0) {
    throw new Error('Greutatea gătită totală trebuie să fie un număr strict pozitiv.');
  }

  const totalCalories = params.ingredients.reduce((s, i) => s + (i.caloriesPer100 || 0) * ((i.rawGrams || 0) / 100), 0);
  const totalProtein = params.ingredients.reduce((s, i) => s + (i.proteinPer100 || 0) * ((i.rawGrams || 0) / 100), 0);
  const totalCarbs = params.ingredients.reduce((s, i) => s + (i.carbsPer100 || 0) * ((i.rawGrams || 0) / 100), 0);
  const totalFat = params.ingredients.reduce((s, i) => s + (i.fatPer100 || 0) * ((i.rawGrams || 0) / 100), 0);

  const ratio = 100 / cookedWeightTotal;
  const now = Date.now();

  const recipe: Recipe = {
    id: crypto.randomUUID(),
    name,
    status: params.status || 'published',
    category: params.category,
    tags: params.tags || [],
    ingredients: params.ingredients,
    steps: params.steps || [],
    servings: Math.max(1, params.servings || 1),
    rawWeightTotal: Math.round(rawWeightTotal * 10) / 10,
    cookedWeightTotal: Math.round(cookedWeightTotal * 10) / 10,
    caloriesPer100Cooked: Math.round(totalCalories * ratio),
    proteinPer100Cooked: Math.round(totalProtein * ratio * 10) / 10,
    carbsPer100Cooked: Math.round(totalCarbs * ratio * 10) / 10,
    fatPer100Cooked: Math.round(totalFat * ratio * 10) / 10,
    sourceUrl: params.sourceUrl,
    notes: params.notes,
    createdAt: now,
    audit: {
      createdAt: now,
      updatedAt: now,
      timesLogged: 0,
    },
  };

  await db.recipes.add(recipe);
  return recipe;
}

export async function updateRecipe(recipe: Recipe) {
  const name = recipe.name.trim();
  if (!name) throw new Error('Numele rețetei este obligatoriu.');
  if (recipe.cookedWeightTotal <= 0) throw new Error('Greutatea gătită trebuie să fie pozitivă.');

  const rawWeightTotal = recipe.ingredients.reduce((s, i) => s + (Number.isFinite(i.rawGrams) ? i.rawGrams : 0), 0);
  const totalCalories = recipe.ingredients.reduce((s, i) => s + (i.caloriesPer100 || 0) * ((i.rawGrams || 0) / 100), 0);
  const totalProtein = recipe.ingredients.reduce((s, i) => s + (i.proteinPer100 || 0) * ((i.rawGrams || 0) / 100), 0);
  const totalCarbs = recipe.ingredients.reduce((s, i) => s + (i.carbsPer100 || 0) * ((i.rawGrams || 0) / 100), 0);
  const totalFat = recipe.ingredients.reduce((s, i) => s + (i.fatPer100 || 0) * ((i.rawGrams || 0) / 100), 0);

  const ratio = 100 / recipe.cookedWeightTotal;

  const updated: Recipe = {
    ...recipe,
    name,
    rawWeightTotal: Math.round(rawWeightTotal * 10) / 10,
    caloriesPer100Cooked: Math.round(totalCalories * ratio),
    proteinPer100Cooked: Math.round(totalProtein * ratio * 10) / 10,
    carbsPer100Cooked: Math.round(totalCarbs * ratio * 10) / 10,
    fatPer100Cooked: Math.round(totalFat * ratio * 10) / 10,
    audit: {
      ...recipe.audit,
      updatedAt: Date.now(),
    },
  };

  await db.recipes.put(updated);
  return updated;
}

export async function duplicateRecipe(id: string): Promise<Recipe> {
  const original = await db.recipes.get(id);
  if (!original) throw new Error('Rețeta nu a fost găsită.');

  const now = Date.now();
  const copy: Recipe = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} (Copie)`,
    status: 'draft',
    createdAt: now,
    audit: {
      createdAt: now,
      updatedAt: now,
      timesLogged: 0,
    },
  };

  await db.recipes.add(copy);
  return copy;
}

export async function bulkDeleteRecipes(ids: string[]) {
  await db.transaction('rw', db.recipes, async () => {
    for (const id of ids) {
      await db.recipes.delete(id);
    }
  });
}

export async function bulkSetRecipeStatus(ids: string[], status: RecipeStatus) {
  const now = Date.now();
  await db.transaction('rw', db.recipes, async () => {
    for (const id of ids) {
      await db.recipes.update(id, {
        status,
        'audit.updatedAt': now,
      });
    }
  });
}

export async function deleteRecipe(id: string) {
  await db.recipes.delete(id);
}

export async function incrementRecipeLoggedCount(id: string) {
  const recipe = await db.recipes.get(id);
  if (recipe) {
    const currentCount = recipe.audit?.timesLogged ?? 0;
    await db.recipes.update(id, {
      'audit.timesLogged': currentCount + 1,
      'audit.updatedAt': Date.now(),
    });
  }
}

export async function logRecipeByGrams(params: {
  date: string;
  mealType: MealType;
  recipe: Recipe;
  grams: number;
  status?: LogEntryStatus;
}) {
  const grams = Number(params.grams);
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error('Gramajul consumat trebuie să fie un număr pozitiv.');
  }
  const ratio = grams / 100;

  await db.logs.add({
    id: crypto.randomUUID(),
    date: params.date,
    mealType: params.mealType,
    status: params.status || 'consumed',
    recipeId: params.recipe.id,
    name: params.recipe.name,
    amountGrams: Math.round(grams),
    calories: Math.round(params.recipe.caloriesPer100Cooked * ratio),
    protein: Math.round(params.recipe.proteinPer100Cooked * ratio * 10) / 10,
    carbs: Math.round(params.recipe.carbsPer100Cooked * ratio * 10) / 10,
    fat: Math.round(params.recipe.fatPer100Cooked * ratio * 10) / 10,
    loggedAt: Date.now(),
  });

  incrementRecipeLoggedCount(params.recipe.id).catch(() => {});
}

export async function logFoodByGrams(params: {
  date: string;
  mealType: MealType;
  food: FoodItem;
  grams: number;
  status?: LogEntryStatus;
}) {
  const grams = Number(params.grams);
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error('Gramajul consumat trebuie să fie un număr pozitiv.');
  }
  const ratio = grams / 100;

  await db.logs.add({
    id: crypto.randomUUID(),
    date: params.date,
    mealType: params.mealType,
    status: params.status || 'consumed',
    foodId: params.food.id,
    name: params.food.name,
    amountGrams: Math.round(grams),
    calories: Math.round(params.food.caloriesPer100 * ratio),
    protein: Math.round(params.food.proteinPer100 * ratio * 10) / 10,
    carbs: Math.round(params.food.carbsPer100 * ratio * 10) / 10,
    fat: Math.round(params.food.fatPer100 * ratio * 10) / 10,
    loggedAt: Date.now(),
  });
}
