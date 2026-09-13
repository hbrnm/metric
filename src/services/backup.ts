import { db } from '../db';

interface BackupPayload {
  version: number;
  exportedAt: string;
  logs: unknown[];
  weights: unknown[];
  targets: unknown[];
  foods: unknown[];
  recipes: unknown[];
}

export async function exportBackup() {
  const payload: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    logs: await db.logs.toArray(),
    weights: await db.weights.toArray(),
    targets: await db.targets.toArray(),
    foods: await db.foods.toArray(),
    recipes: await db.recipes.toArray(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metric_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<{ success: boolean; error?: string }> {
  let data: BackupPayload;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return { success: false, error: 'Fișierul nu e un JSON valid.' };
  }

  if (data.version !== 1 || !Array.isArray(data.logs)) {
    return { success: false, error: 'Fișierul nu are formatul unui backup Metric recunoscut.' };
  }

  try {
    await db.transaction('rw', [db.logs, db.weights, db.targets, db.foods, db.recipes], async () => {
      if (data.logs.length) await db.logs.bulkPut(data.logs as never[]);
      if (data.weights.length) await db.weights.bulkPut(data.weights as never[]);
      if (data.targets.length) await db.targets.bulkPut(data.targets as never[]);
      if (data.foods.length) await db.foods.bulkPut(data.foods as never[]);
      if (data.recipes.length) await db.recipes.bulkPut(data.recipes as never[]);
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
