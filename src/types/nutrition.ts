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

export type LogEntryStatus = 'consumed' | 'planned' | 'skipped';

export interface LogEntry {
  id: string;
  date: string;        // 'YYYY-MM-DD'
  mealType: MealType;
  status: LogEntryStatus;
  foodId?: string;
  recipeId?: string;
  name: string;
  amountGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  timeOfDay?: string;  // ex: '08:30'
  notes?: string;
  loggedAt: number;
}

export type WeightMeasurementContext = 'fasted_morning' | 'post_workout' | 'evening';

export interface WeightEntry {
  date: string;        // 'YYYY-MM-DD' — cheie unică per zi
  weightKg: number;
  trendWeight: number; // greutatea filtrată prin EMA
  bodyFatPercent?: number;
  waistCm?: number;
  hipsCm?: number;
  context?: WeightMeasurementContext;
  notes?: string;
  loggedAt: number;
}

export interface WeightProjection {
  goalWeightKg: number;
  currentTrendWeight: number;
  weeklyDeltaKg: number;
  dailyCalorieDeficitOrSurplus: number;
  estimatedWeeks: number;
  estimatedDate: string;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  rawGrams: number;
  caloriesPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  foodId?: string;     // legătură opțională directă cu un produs din db.foods
  unit?: string;       // unitate originală ('g', 'ml', 'buc', etc.)
}

export type RecipeStatus = 'draft' | 'published' | 'archived';
export type RecipeCategory = 'meal' | 'snack' | 'dessert' | 'prep';

export interface RecipeStep {
  stepNumber: number;
  instruction: string;
  timerMinutes?: number;
}

export interface RecipeAudit {
  createdAt: number;
  updatedAt: number;
  timesLogged: number;
}

export interface Recipe {
  id: string;
  name: string;
  status: RecipeStatus;
  category?: RecipeCategory;
  tags: string[];
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  servings: number;
  rawWeightTotal: number;
  cookedWeightTotal: number;
  caloriesPer100Cooked: number;
  proteinPer100Cooked: number;
  carbsPer100Cooked: number;
  fatPer100Cooked: number;
  sourceUrl?: string;
  notes?: string;
  createdAt: number;
  audit: RecipeAudit;
}

export interface MealTemplateItem {
  name: string;
  amountGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  foodId?: string;
  recipeId?: string;
}

export interface MealTemplate {
  id: string;
  name: string;
  mealType: MealType;
  items: MealTemplateItem[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  createdAt: number;
}

export interface WaterLog {
  date: string;        // 'YYYY-MM-DD'
  milliliters: number;
  targetMl: number;
  updatedAt: number;
}

export interface WeeklyTarget {
  id: string;
  effectiveFrom: string; // 'YYYY-MM-DD' — data de la care intră în vigoare
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
