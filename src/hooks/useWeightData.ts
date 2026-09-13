import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { computeAdaptiveTDEE, MetabolicAnalysis } from '../algorithms/metabolic';

const ANALYSIS_WINDOW_DAYS = 21;

export function useWeightData(): {
  history: { date: string; weightKg: number; trendWeight: number }[];
  analysis: MetabolicAnalysis;
} {
  const result = useLiveQuery(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - ANALYSIS_WINDOW_DAYS);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const weights = await db.weights.where('date').aboveOrEqual(cutoffStr).sortBy('date');
    const logs = await db.logs.where('date').aboveOrEqual(cutoffStr).toArray();

    const analysis = computeAdaptiveTDEE(weights, logs);
    return { history: weights, analysis };
  });

  return result ?? { history: [], analysis: { isReliable: false, reason: 'Se încarcă...' } };
}
