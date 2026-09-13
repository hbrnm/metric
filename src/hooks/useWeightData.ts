import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { computeAdaptiveTDEE, MetabolicAnalysis } from '../algorithms/metabolic';
import { getLocalDateString, shiftDate } from '../utils/date';
import { WeightEntry } from '../types/nutrition';

const ANALYSIS_WINDOW_DAYS = 21;

export function useWeightData(): {
  history: WeightEntry[];
  analysis: MetabolicAnalysis;
} {
  const result = useLiveQuery(async () => {
    const today = getLocalDateString();
    const cutoffStr = shiftDate(today, -ANALYSIS_WINDOW_DAYS);

    const weights = await db.weights.orderBy('date').toArray();
    const analysisWeights = weights.filter((w) => w.date >= cutoffStr);
    const logs = await db.logs.where('date').aboveOrEqual(cutoffStr).toArray();

    const analysis = computeAdaptiveTDEE(analysisWeights, logs);
    return { history: weights, analysis };
  }, []);

  return result ?? { history: [], analysis: { isReliable: false, reason: 'Se încarcă datele...' } };
}
