import { db } from '../db';
import { getLocalDateString } from '../utils/date';

interface BackupPayload {
  version: number;
  exportedAt: string;
  logs: unknown[];
  weights: unknown[];
  targets: unknown[];
  foods: unknown[];
  recipes: unknown[];
  mealTemplates?: unknown[];
  waterLogs?: unknown[];
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
    mealTemplates: await db.mealTemplates.toArray(),
    waterLogs: await db.waterLogs.toArray(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metric_backup_${getLocalDateString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

export async function exportCSV() {
  const logs = await db.logs.orderBy('date').toArray();
  const headers = ['Data', 'Masa', 'Status', 'Aliment', 'Gramaj (g)', 'Calorii (kcal)', 'Proteine (g)', 'Carbohidrati (g)', 'Grasimi (g)'];
  const rows = logs.map((l) => [
    l.date,
    l.mealType,
    l.status,
    `"${l.name.replace(/"/g, '""')}"`,
    l.amountGrams ?? '',
    l.calories,
    l.protein,
    l.carbs,
    l.fat,
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `metric_jurnal_complet_${getLocalDateString()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

export async function importBackup(file: File): Promise<{ success: boolean; error?: string }> {
  let data: Partial<BackupPayload>;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch {
    return { success: false, error: 'Fișierul nu este un JSON valid.' };
  }

  if (!data || typeof data !== 'object' || data.version !== 1) {
    return { success: false, error: 'Fișierul nu are formatul unui backup Metric recunoscut.' };
  }

  const logs = Array.isArray(data.logs) ? data.logs : [];
  const weights = Array.isArray(data.weights) ? data.weights : [];
  const targets = Array.isArray(data.targets) ? data.targets : [];
  const foods = Array.isArray(data.foods) ? data.foods : [];
  const recipes = Array.isArray(data.recipes) ? data.recipes : [];
  const mealTemplates = Array.isArray(data.mealTemplates) ? data.mealTemplates : [];
  const waterLogs = Array.isArray(data.waterLogs) ? data.waterLogs : [];

  try {
    await db.transaction('rw', [db.logs, db.weights, db.targets, db.foods, db.recipes, db.mealTemplates, db.waterLogs], async () => {
      if (logs.length > 0) await db.logs.bulkPut(logs as never[]);
      if (weights.length > 0) await db.weights.bulkPut(weights as never[]);
      if (targets.length > 0) await db.targets.bulkPut(targets as never[]);
      if (foods.length > 0) await db.foods.bulkPut(foods as never[]);
      if (recipes.length > 0) await db.recipes.bulkPut(recipes as never[]);
      if (mealTemplates.length > 0) await db.mealTemplates.bulkPut(mealTemplates as never[]);
      if (waterLogs.length > 0) await db.waterLogs.bulkPut(waterLogs as never[]);
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
