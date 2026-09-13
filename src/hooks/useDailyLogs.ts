import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { LogEntry, MealType } from '../types/nutrition';

export function useDailyLogs(date: string) {
  const logs = useLiveQuery(
    () => db.logs.where('date').equals(date).sortBy('loggedAt'),
    [date]
  ) ?? [];

  const byMeal: Record<MealType, LogEntry[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };

  let consumedCalories = 0;
  let consumedProtein = 0;
  let consumedCarbs = 0;
  let consumedFat = 0;

  let plannedCalories = 0;
  let plannedProtein = 0;
  let plannedCarbs = 0;
  let plannedFat = 0;

  for (const entry of logs) {
    const meal = (entry.mealType && byMeal[entry.mealType]) ? entry.mealType : 'snack';
    byMeal[meal].push(entry);

    const isConsumed = (entry.status || 'consumed') === 'consumed';
    const c = Number.isFinite(entry.calories) ? entry.calories : 0;
    const p = Number.isFinite(entry.protein) ? entry.protein : 0;
    const cb = Number.isFinite(entry.carbs) ? entry.carbs : 0;
    const f = Number.isFinite(entry.fat) ? entry.fat : 0;

    if (isConsumed) {
      consumedCalories += c;
      consumedProtein += p;
      consumedCarbs += cb;
      consumedFat += f;
    } else if (entry.status === 'planned') {
      plannedCalories += c;
      plannedProtein += p;
      plannedCarbs += cb;
      plannedFat += f;
    }
  }

  return {
    logs,
    byMeal,
    // Consumate efectiv
    totalCalories: Math.round(consumedCalories),
    totalProtein: Math.round(consumedProtein * 10) / 10,
    totalCarbs: Math.round(consumedCarbs * 10) / 10,
    totalFat: Math.round(consumedFat * 10) / 10,
    // Planificate
    plannedCalories: Math.round(plannedCalories),
    plannedProtein: Math.round(plannedProtein * 10) / 10,
    plannedCarbs: Math.round(plannedCarbs * 10) / 10,
    plannedFat: Math.round(plannedFat * 10) / 10,
    hasPlanned: plannedCalories > 0,
  };
}
