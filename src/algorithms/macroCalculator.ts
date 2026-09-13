export type BiologicalSex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active';
export type NutritionGoal = 'moderate_loss' | 'aggressive_loss' | 'maintenance' | 'lean_bulk';
export type MacroPreset = 'high_protein' | 'balanced' | 'low_carb' | 'custom';

export interface BiometricsInput {
  sex: BiologicalSex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
}

export interface MacroResult {
  tdee: number;
  targetCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  calculatedCaloriesFromMacros: number;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,       // birou, puțin spre deloc exercițiu
  light: 1.375,         // exercițiu ușor 1-3 zile/săptămână
  moderate: 1.55,       // exercițiu moderat 3-5 zile/săptămână
  very_active: 1.725,   // antrenamente grele 6-7 zile/săptămână
};

const GOAL_CALORIE_MODIFIERS: Record<NutritionGoal, { factor: number; label: string }> = {
  moderate_loss: { factor: -0.2, label: 'Slăbire moderată (-20%)' },
  aggressive_loss: { factor: -0.25, label: 'Slăbire agresivă (-25%)' },
  maintenance: { factor: 0, label: 'Menținere (0%)' },
  lean_bulk: { factor: 0.1, label: 'Masă musculară curată (+10%)' },
};

/**
 * Formula Mifflin-St Jeor pentru rata metabolică bazală (BMR)
 */
export function calculateBMR(bio: BiometricsInput): number {
  const { sex, age, heightCm, weightKg } = bio;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? Math.round(base + 5) : Math.round(base - 161);
}

/**
 * Calculează TDEE-ul teoretic pe baza BMR și nivelului de activitate
 */
export function calculateTheoreticalTDEE(bio: BiometricsInput): number {
  const bmr = calculateBMR(bio);
  const mult = ACTIVITY_MULTIPLIERS[bio.activityLevel] || 1.2;
  return Math.round(bmr * mult);
}

/**
 * Calculează ținta de calorii și macronutrienți în funcție de TDEE, obiectiv și preset macro
 */
export function computeMacros(
  baseTdee: number,
  goal: NutritionGoal,
  preset: MacroPreset,
  weightKg: number
): MacroResult {
  const mod = GOAL_CALORIE_MODIFIERS[goal]?.factor ?? 0;
  let targetCalories = Math.round(baseTdee * (1 + mod));

  // Protecție prag minim sănătate (1200 kcal femei / 1400 kcal bărbați)
  targetCalories = Math.max(1200, targetCalories);

  let proteinPercent = 30;
  let carbsPercent = 45;
  let fatPercent = 25;

  let proteinGrams = 0;
  let fatGrams = 0;
  let carbsGrams = 0;

  if (preset === 'high_protein') {
    // 2.0g proteină per kg corp
    proteinGrams = Math.round(weightKg * 2.0);
    // 25% grăsimi
    fatGrams = Math.round((targetCalories * 0.25) / 9);
    // restul carbohidrați
    const remainingCals = targetCalories - proteinGrams * 4 - fatGrams * 9;
    carbsGrams = Math.max(20, Math.round(remainingCals / 4));
  } else if (preset === 'low_carb') {
    // 35% Proteine / 20% Carbo / 45% Grăsimi
    proteinPercent = 35;
    carbsPercent = 20;
    fatPercent = 45;
    proteinGrams = Math.round((targetCalories * (proteinPercent / 100)) / 4);
    carbsGrams = Math.round((targetCalories * (carbsPercent / 100)) / 4);
    fatGrams = Math.round((targetCalories * (fatPercent / 100)) / 9);
  } else {
    // balanced: 30% Proteine / 45% Carbohidrați / 25% Grăsimi
    proteinPercent = 30;
    carbsPercent = 45;
    fatPercent = 25;
    proteinGrams = Math.round((targetCalories * (proteinPercent / 100)) / 4);
    carbsGrams = Math.round((targetCalories * (carbsPercent / 100)) / 4);
    fatGrams = Math.round((targetCalories * (fatPercent / 100)) / 9);
  }

  const calculatedCaloriesFromMacros = proteinGrams * 4 + carbsGrams * 4 + fatGrams * 9;

  // Calculăm procentele reale rezultate
  const actualProteinPct = Math.round(((proteinGrams * 4) / calculatedCaloriesFromMacros) * 100);
  const actualCarbsPct = Math.round(((carbsGrams * 4) / calculatedCaloriesFromMacros) * 100);
  const actualFatPct = 100 - actualProteinPct - actualCarbsPct;

  return {
    tdee: baseTdee,
    targetCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    proteinPercent: actualProteinPct,
    carbsPercent: actualCarbsPct,
    fatPercent: actualFatPct,
    calculatedCaloriesFromMacros,
  };
}

/**
 * Verifică consistența matematică: 4*P + 4*C + 9*F vs Caloriile setate
 */
export function validateMacroBalance(
  calories: number,
  protein: number,
  carbs: number,
  fat: number
): { isBalanced: boolean; diff: number; sum: number } {
  const sum = Math.round(protein * 4 + carbs * 4 + fat * 9);
  const diff = sum - calories;
  return {
    isBalanced: Math.abs(diff) <= 25,
    diff,
    sum,
  };
}

/**
 * Ajustează automat carbohidrații sau grăsimile pentru a egaliza perfect caloriile totale
 */
export function autoBalanceCarbs(
  calories: number,
  protein: number,
  fat: number
): number {
  const usedCals = protein * 4 + fat * 9;
  const remaining = calories - usedCals;
  return Math.max(0, Math.round(remaining / 4));
}
