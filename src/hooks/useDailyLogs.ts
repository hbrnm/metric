import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { LogEntry, MealType } from '../types/nutrition';

export function useDailyLogs(date: string) {
  const logs = useLiveQuery(
    () => db.logs.where('date').equals(date).sortBy('loggedAt'),
    [date]
  ) ?? [];

  const byMeal: Record<MealType, LogEntry[]> = {
    breakfast: [], lunch: [], dinner: [], snack: [],
  };
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const entry of logs) {
    byMeal[entry.mealType].push(entry);
    totalCalories += entry.calories;
    totalProtein += entry.protein;
    totalCarbs += entry.carbs;
    totalFat += entry.fat;
  }

  return { logs, byMeal, totalCalories, totalProtein, totalCarbs, totalFat };
}
