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
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      { headers: { 'User-Agent': 'MetricApp - WebApp - v1.0' } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments || {};

    const calories = Math.round(
      n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0)
    );
    if (!calories || calories <= 0) return null; // date incomplete, nu salvăm gunoi

    const food: FoodItem = {
      id: crypto.randomUUID(),
      barcode,
      name: p.product_name_ro || p.product_name || 'Produs fără nume',
      caloriesPer100: calories,
      proteinPer100: Math.round((n['proteins_100g'] ?? 0) * 10) / 10,
      carbsPer100: Math.round((n['carbohydrates_100g'] ?? 0) * 10) / 10,
      fatPer100: Math.round((n['fat_100g'] ?? 0) * 10) / 10,
      isCustom: false,
      createdAt: Date.now(),
    };

    await db.foods.put(food);
    return food;
  } catch {
    return null;
  }
}
