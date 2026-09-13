import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { WaterLog } from '../types/nutrition';

const DEFAULT_TARGET_ML = 2500;

export function useWaterLog(date: string): {
  water: WaterLog;
  percentage: number;
} {
  const record = useLiveQuery(() => db.waterLogs.get(date), [date]);

  const water: WaterLog = record ?? {
    date,
    milliliters: 0,
    targetMl: DEFAULT_TARGET_ML,
    updatedAt: Date.now(),
  };

  const percentage = Math.min(100, Math.round((water.milliliters / water.targetMl) * 100));

  return { water, percentage };
}
