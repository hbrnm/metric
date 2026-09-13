import { WeightEntry, LogEntry } from '../types/nutrition';

const EMA_ALPHA = 0.1;
const KCAL_PER_KG_FAT = 7700;
const MIN_TDEE = 1200;
const MAX_TDEE = 4500;
const MIN_WEIGHT_DAYS = 7;
const MIN_LOGGED_COVERAGE = 0.6; // cel puțin 60% din zilele ferestrei trebuie să aibă calorii logate

export function computeNextEMA(currentWeight: number, previousTrend?: number): number {
  if (previousTrend === undefined || previousTrend === 0) {
    return Math.round(currentWeight * 100) / 100;
  }
  const ema = EMA_ALPHA * currentWeight + (1 - EMA_ALPHA) * previousTrend;
  return Math.round(ema * 100) / 100;
}

export interface MetabolicAnalysis {
  isReliable: boolean;
  reason?: string;
  tdee?: number;
  averageIntake?: number;
  weeklyWeightDelta?: number;
}

/**
 * weights și logs trebuie sortate cronologic ascendent, deja filtrate
 * pe fereastra de analiză (ex. ultimele 14-21 zile).
 */
export function computeAdaptiveTDEE(weights: WeightEntry[], logs: LogEntry[]): MetabolicAnalysis {
  if (weights.length < MIN_WEIGHT_DAYS) {
    return { isReliable: false, reason: `Ai nevoie de cel puțin ${MIN_WEIGHT_DAYS} zile cu greutate înregistrată.` };
  }

  const first = weights[0];
  const last = weights[weights.length - 1];
  const days = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000;

  if (days < MIN_WEIGHT_DAYS - 1) {
    return { isReliable: false, reason: 'Intervalul dintre prima și ultima măsurătoare e prea scurt.' };
  }

  const dailyCalories = new Map<string, number>();
  for (const entry of logs) {
    dailyCalories.set(entry.date, (dailyCalories.get(entry.date) ?? 0) + entry.calories);
  }

  const loggedDays = dailyCalories.size;
  if (loggedDays / days < MIN_LOGGED_COVERAGE) {
    return { isReliable: false, reason: 'Prea puține zile cu mese logate în această fereastră pentru un calcul de încredere.' };
  }

  const totalWeightDelta = last.trendWeight - first.trendWeight;
  const weeklyWeightDelta = Math.round((totalWeightDelta / days) * 7 * 100) / 100;

  const totalCalories = Array.from(dailyCalories.values()).reduce((a, b) => a + b, 0);
  const averageIntake = Math.round(totalCalories / loggedDays);

  const dailyImbalance = (totalWeightDelta * KCAL_PER_KG_FAT) / days;
  const rawTdee = Math.round(averageIntake - dailyImbalance);
  const tdee = Math.max(MIN_TDEE, Math.min(MAX_TDEE, rawTdee));

  return { isReliable: true, tdee, averageIntake, weeklyWeightDelta };
}
