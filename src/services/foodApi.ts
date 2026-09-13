import { db } from '../db';
import { FoodItem } from '../types/nutrition';

export async function fetchFoodByBarcode(rawBarcode: string): Promise<FoodItem | null> {
  const barcode = rawBarcode.trim();
  if (!barcode) return null;

  // 1. Cache local — instant, offline
  const cached = await db.foods.where('barcode').equals(barcode).first();
  if (cached) return cached;

  // 2. Open Food Facts
  try {
    const encodedBarcode = encodeURIComponent(barcode);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodedBarcode}.json`,
      {
        headers: { 'User-Agent': 'MetricApp - WebApp - v1.0 (contact: local)' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments || {};

    const rawEnergyKcal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
    const calories = Math.round(Number(rawEnergyKcal));

    if (!Number.isFinite(calories) || calories <= 0) return null; // date incomplete

    const food: FoodItem = {
      id: crypto.randomUUID(),
      barcode,
      name: (p.product_name_ro || p.product_name || 'Produs fără nume').trim(),
      caloriesPer100: calories,
      proteinPer100: Math.round((Number(n['proteins_100g']) || 0) * 10) / 10,
      carbsPer100: Math.round((Number(n['carbohydrates_100g']) || 0) * 10) / 10,
      fatPer100: Math.round((Number(n['fat_100g']) || 0) * 10) / 10,
      isCustom: false,
      createdAt: Date.now(),
    };

    // Verificăm încă o dată în DB pentru a preveni erori de cheie unică duplicată
    const existing = await db.foods.where('barcode').equals(barcode).first();
    if (existing) {
      food.id = existing.id;
    }

    await db.foods.put(food);
    return food;
  } catch {
    return null;
  }
}

/**
 * Caută produse alimentare online pe Open Food Facts (România & Internațional)
 */
export async function searchFoodOnline(query: string, limit = 8): Promise<FoodItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const encoded = encodeURIComponent(q);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=${limit}&lc=ro`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MetricApp - WebApp - v1.0 (contact: local)' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];
    const data = await res.json();
    const products = Array.isArray(data.products) ? data.products : [];

    const results: FoodItem[] = [];

    for (const p of products) {
      const name = (p.product_name_ro || p.product_name || '').trim();
      if (!name) continue;

      const n = p.nutriments || {};
      const rawEnergyKcal =
        n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
      const calories = Math.round(Number(rawEnergyKcal));
      if (!Number.isFinite(calories) || calories <= 0) continue;

      const protein = Math.round((Number(n['proteins_100g']) || 0) * 10) / 10;
      const carbs = Math.round((Number(n['carbohydrates_100g']) || 0) * 10) / 10;
      const fat = Math.round((Number(n['fat_100g']) || 0) * 10) / 10;

      results.push({
        id: crypto.randomUUID(),
        barcode: p.code || undefined,
        name: p.brands ? `${name} (${p.brands})` : name,
        caloriesPer100: calories,
        proteinPer100: protein,
        carbsPer100: carbs,
        fatPer100: fat,
        isCustom: false,
        createdAt: Date.now(),
      });
    }

    return results;
  } catch {
    return [];
  }
}
