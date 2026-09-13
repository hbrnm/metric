import { WeightEntry, LogEntry, WeightProjection } from '../types/nutrition';
import { shiftDate, formatDisplayDate, getLocalDateString } from '../utils/date';

const EMA_ALPHA = 0.1;
const KCAL_PER_KG_FAT = 7700;
const MIN_TDEE = 1200;
const MAX_TDEE = 4500;
const MIN_WEIGHT_DAYS = 7;
const MIN_LOGGED_COVERAGE = 0.6; // cel puțin 60% din zilele ferestrei trebuie să aibă calorii logate

export function computeNextEMA(currentWeight: number, previousTrend?: number): number {
  if (!Number.isFinite(currentWeight)) return previousTrend ?? 0;
  if (previousTrend === undefined || previousTrend === 0 || !Number.isFinite(previousTrend)) {
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
 * weights trebuie sortate cronologic ascendent.
 * logs sunt filtrate automat pentru a corespunde exact intervalului [weights[0].date, weights[last].date].
 */
export function computeAdaptiveTDEE(weights: WeightEntry[], logs: LogEntry[]): MetabolicAnalysis {
  if (weights.length < MIN_WEIGHT_DAYS) {
    return { isReliable: false, reason: `Ai nevoie de cel puțin ${MIN_WEIGHT_DAYS} zile cu greutate înregistrată.` };
  }

  const first = weights[0];
  const last = weights[weights.length - 1];

  const firstTime = new Date(first.date + 'T00:00:00').getTime();
  const lastTime = new Date(last.date + 'T00:00:00').getTime();
  const days = Math.round((lastTime - firstTime) / 86_400_000);

  if (days < MIN_WEIGHT_DAYS - 1) {
    return { isReliable: false, reason: 'Intervalul dintre prima și ultima măsurătoare e prea scurt.' };
  }

  const calendarDays = days + 1;

  // Filtrăm jurnalele alimentare STRICT în intervalul ferestrei de greutate
  const dailyCalories = new Map<string, number>();
  for (const entry of logs) {
    if (entry.date >= first.date && entry.date <= last.date) {
      const cals = Number.isFinite(entry.calories) ? entry.calories : 0;
      dailyCalories.set(entry.date, (dailyCalories.get(entry.date) ?? 0) + cals);
    }
  }

  const loggedDays = dailyCalories.size;
  if (loggedDays / calendarDays < MIN_LOGGED_COVERAGE) {
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

/**
 * Detectează fluctuațiile bruște cauzate de retenția de apă sau rezervele de glicogen.
 */
export function detectWaterSpike(
  currentWeight: number,
  previousWeight?: number,
  currentTrend?: number
): { isSpike: boolean; deltaKg: number; message?: string } {
  if (!previousWeight || !Number.isFinite(previousWeight)) {
    return { isSpike: false, deltaKg: 0 };
  }

  const delta = Math.round((currentWeight - previousWeight) * 10) / 10;

  // Dacă greutatea a sărit cu >= 1.0 kg într-o singură zi
  if (delta >= 1.0) {
    const trendDiff = currentTrend ? Math.round((currentWeight - currentTrend) * 10) / 10 : delta;
    return {
      isSpike: true,
      deltaKg: delta,
      message: `Creștere bruscă de +${delta} kg față de ieri. Este o retenție fiziologică normală de apă și glicogen (cina cu mai mult sodiu/carbohidrați sau inflamație musculară), nu grăsime. Trendul tău real este de ${currentTrend || currentWeight} kg (${trendDiff > 0 ? '+' : ''}${trendDiff} kg).`,
    };
  }

  return { isSpike: false, deltaKg: delta };
}

/**
 * Calculează proiecția de atingere a greutății țintă bazată pe TDEE-ul adaptiv.
 */
export function calculateWeightProjection(
  currentTrendWeight: number,
  goalWeightKg: number,
  tdee: number,
  dailyCalorieIntake: number
): WeightProjection | null {
  if (!Number.isFinite(currentTrendWeight) || !Number.isFinite(goalWeightKg) || !Number.isFinite(tdee) || !Number.isFinite(dailyCalorieIntake)) {
    return null;
  }

  const weightDeltaToLoseOrGain = goalWeightKg - currentTrendWeight; // negativ dacă vrea să slăbească
  if (Math.abs(weightDeltaToLoseOrGain) < 0.2) {
    return null; // a atins deja obiectivul
  }

  const dailyDeficitOrSurplus = dailyCalorieIntake - tdee; // negativ = deficit, pozitiv = surplus

  // Verificăm direcția: dacă vrea să slăbească, trebuie deficit (dailyDeficit < 0)
  if (weightDeltaToLoseOrGain < 0 && dailyDeficitOrSurplus >= 0) {
    return null; // vrea să slăbească dar e în surplus sau mentenanță
  }
  if (weightDeltaToLoseOrGain > 0 && dailyDeficitOrSurplus <= 0) {
    return null; // vrea să se îngrașe dar e în deficit
  }

  // Ritm săptămânal de slăbire/creștere în kg: (deficit_zilnic * 7) / 7700
  const weeklyDeltaKg = Math.round(((dailyDeficitOrSurplus * 7) / KCAL_PER_KG_FAT) * 100) / 100;
  if (Math.abs(weeklyDeltaKg) < 0.05) return null;

  const totalWeeks = Math.abs(weightDeltaToLoseOrGain / weeklyDeltaKg);
  const totalDays = Math.round(totalWeeks * 7);

  const todayStr = getLocalDateString();
  const targetDateStr = shiftDate(todayStr, totalDays);

  return {
    goalWeightKg,
    currentTrendWeight,
    weeklyDeltaKg,
    dailyCalorieDeficitOrSurplus: Math.round(dailyDeficitOrSurplus),
    estimatedWeeks: Math.round(totalWeeks * 10) / 10,
    estimatedDate: formatDisplayDate(targetDateStr),
  };
}
