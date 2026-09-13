import { db } from '../db';
import { FoodItem, RecipeIngredient, RecipeStep } from '../types/nutrition';

export interface ParsedRecipeDraft {
  name: string;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  sourceUrl?: string;
  notes?: string;
  estimatedCookedWeight?: number;
}

/**
 * Curăță textul de elemente specifice rețelelor sociale (hashtag-uri, mențiuni, emoji).
 */
export function cleanSocialText(text: string): string {
  return text
    .replace(/#[\w\u00C0-\u024F]+/gi, '') // elimină hashtag-uri
    .replace(/@[\w.]+/gi, '')             // elimină mențiuni
    .replace(/https?:\/\/\S+/gi, '')      // elimină link-uri
    .trim();
}

/**
 * Normalizează unitățile de măsură în grame aproximative.
 */
function normalizeToGrams(qty: number, unit?: string): number {
  if (!unit) return qty;
  const u = unit.toLowerCase();
  if (u.includes('kg')) return qty * 1000;
  if (u.includes('ml')) return qty; // densitate aprox 1g/ml
  if (u.includes('l') && !u.includes('lingur')) return qty * 1000;
  if (u.includes('lingurita') || u.includes('linguriță')) return qty * 5;
  if (u.includes('lingur') || u.includes('lingură')) return qty * 15;
  if (u.includes('buc') || u.includes('felie') || u.includes('felii')) return qty * 100; // estimare conservatoare
  return qty;
}

/**
 * Caută cel mai apropiat aliment în baza locală `db.foods` pentru auto-completarea nutrienților.
 */
export async function matchFoodItem(ingredientName: string, allFoods?: FoodItem[]): Promise<FoodItem | null> {
  const foods = allFoods ?? await db.foods.toArray();
  if (foods.length === 0) return null;

  const targetWords = ingredientName
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (targetWords.length === 0) return null;

  let bestFood: FoodItem | null = null;
  let maxScore = 0;

  for (const food of foods) {
    const foodNormalized = food.name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let score = 0;
    for (const word of targetWords) {
      if (foodNormalized.includes(word)) {
        score += word.length >= 4 ? 2 : 1;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestFood = food;
    }
  }

  // Acceptăm doar dacă a existat o potrivire semnificativă
  return maxScore >= 2 ? bestFood : null;
}

/**
 * Parsează text liber sau copiat din rețele sociale (Instagram, TikTok, WhatsApp).
 */
export async function parseRawTextIngredients(rawText: string): Promise<ParsedRecipeDraft> {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const foods = await db.foods.toArray();
  const ingredients: RecipeIngredient[] = [];
  const steps: RecipeStep[] = [];
  let isStepSection = false;
  let detectedName = 'Rețetă importată';

  // Expresie regulată pentru cantitate și unitate (ex: "300g piept de pui", "2 linguri ulei", "1.5 kg cartofi")
  const qtyFirstRegex = /^([•\-*0-9.)\s]*)\s*(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grame|ml|l|litri|linguri|lingurite|lingurita|linguriță|buc|bucati|bucăți|felii|pachete)?\s*(?:de\s+)?(.+)$/i;
  // Expresie regulată pentru cantitate în paranteză (ex: "piept de pui (300g)")
  const qtyParenthesisRegex = /^([•\-*0-9.)\s]*)\s*(.+?)\s*\((\d+(?:[.,]\d+)?)\s*(kg|g|gr|ml|l|linguri|buc)?\)$/i;

  let stepCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cleaned = cleanSocialText(line);
    if (!cleaned) continue;

    // Detectare nume în primul rând dacă e scurt
    if (i === 0 && cleaned.length < 50 && !/\d/.test(cleaned)) {
      detectedName = cleaned.replace(/^re[tț]et[aă]:?\s*/i, '');
      continue;
    }

    // Comutare la secțiunea de preparare
    if (/^(mod de preparare|preparare|instructiuni|instrucțiuni|pași|pasi|metodă):?$/i.test(cleaned)) {
      isStepSection = true;
      continue;
    }

    if (isStepSection) {
      steps.push({
        stepNumber: stepCounter++,
        instruction: cleaned.replace(/^[0-9]+[.)\-]\s*/, ''),
      });
      continue;
    }

    // Încercare 1: Cantitate la început
    let match = cleaned.match(qtyFirstRegex);
    if (match) {
      const rawQty = parseFloat(match[2].replace(',', '.'));
      const unit = match[3] || 'g';
      const name = match[4].replace(/^[•\-*0-9.)\s]+/, '').trim();
      const rawGrams = Math.round(normalizeToGrams(rawQty, unit));

      const matchedFood = await matchFoodItem(name, foods);

      ingredients.push({
        id: crypto.randomUUID(),
        name,
        rawGrams: rawGrams > 0 ? rawGrams : 100,
        caloriesPer100: matchedFood?.caloriesPer100 ?? 0,
        proteinPer100: matchedFood?.proteinPer100 ?? 0,
        carbsPer100: matchedFood?.carbsPer100 ?? 0,
        fatPer100: matchedFood?.fatPer100 ?? 0,
        foodId: matchedFood?.id,
        unit,
      });
      continue;
    }

    // Încercare 2: Cantitate în paranteze
    match = cleaned.match(qtyParenthesisRegex);
    if (match) {
      const name = match[2].replace(/^[•\-*0-9.)\s]+/, '').trim();
      const rawQty = parseFloat(match[3].replace(',', '.'));
      const unit = match[4] || 'g';
      const rawGrams = Math.round(normalizeToGrams(rawQty, unit));

      const matchedFood = await matchFoodItem(name, foods);

      ingredients.push({
        id: crypto.randomUUID(),
        name,
        rawGrams: rawGrams > 0 ? rawGrams : 100,
        caloriesPer100: matchedFood?.caloriesPer100 ?? 0,
        proteinPer100: matchedFood?.proteinPer100 ?? 0,
        carbsPer100: matchedFood?.carbsPer100 ?? 0,
        fatPer100: matchedFood?.fatPer100 ?? 0,
        foodId: matchedFood?.id,
        unit,
      });
      continue;
    }

    // Dacă linia conține verb sau frază lungă, probabil este un pas de preparare
    if (cleaned.length > 50 || /^(pune|fierbe|taie|amestecă|amesteca|coace|lasă|la foc|încălzește)/i.test(cleaned)) {
      steps.push({
        stepNumber: stepCounter++,
        instruction: cleaned.replace(/^[0-9]+[.)\-]\s*/, ''),
      });
    }
  }

  const rawWeightTotal = ingredients.reduce((s, i) => s + i.rawGrams, 0);

  return {
    name: detectedName,
    servings: 2,
    ingredients,
    steps,
    estimatedCookedWeight: Math.round(rawWeightTotal * 0.9), // scădere medie ~10% la gătit
  };
}

/**
 * Extrage rețeta dintr-un URL web (folosind schema.org / JSON-LD prin proxy CORS).
 */
export async function fetchRecipeFromUrl(targetUrl: string): Promise<ParsedRecipeDraft> {
  const trimmedUrl = targetUrl.trim();
  if (!trimmedUrl.startsWith('http')) {
    throw new Error('Te rugăm să introduci o adresă web validă (care începe cu http sau https).');
  }

  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(trimmedUrl)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  let html = '';
  try {
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Serverul a răspuns cu eroarea: ${res.status}`);
    html = await res.text();
  } catch (err) {
    clearTimeout(timeoutId);
    throw new Error('Nu s-a putut descărca pagina web. Verifică link-ul sau conexiunea la internet.');
  }

  // Căutare tag-uri <script type="application/ld+json">
  const ldJsonRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  let recipeLd: Record<string, unknown> | null = null;

  while ((match = ldJsonRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        recipeLd = parsed.find((item) => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
      } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        recipeLd = parsed['@graph'].find((item: Record<string, unknown>) => item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe')));
      } else if (parsed['@type'] === 'Recipe' || (Array.isArray(parsed['@type']) && parsed['@type'].includes('Recipe'))) {
        recipeLd = parsed;
      }
      if (recipeLd) break;
    } catch {
      // JSON invalid pe un script oarecare, continuăm
    }
  }

  if (!recipeLd) {
    // Fallback: încercăm să extragem titlul din tag-ul <title>
    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const pageTitle = titleMatch ? titleMatch[1].split(/[|\-–]/)[0].trim() : 'Rețetă web';
    throw new Error(`Nu am găsit o structură standard Schema.org Recipe pe pagina „${pageTitle}”. Poți copia ingredientele manual în tab-ul „Smart Paste”.`);
  }

  const recipeName = String(recipeLd.name || 'Rețetă fără titlu').trim();
  const rawIngredients: string[] = Array.isArray(recipeLd.recipeIngredient) ? recipeLd.recipeIngredient.map(String) : [];

  // Parsare pași
  const steps: RecipeStep[] = [];
  if (Array.isArray(recipeLd.recipeInstructions)) {
    recipeLd.recipeInstructions.forEach((step, idx) => {
      let text = '';
      if (typeof step === 'string') text = step;
      else if (typeof step === 'object' && step !== null) {
        text = String((step as Record<string, unknown>).text || (step as Record<string, unknown>).name || '');
      }
      if (text.trim()) {
        steps.push({ stepNumber: idx + 1, instruction: text.trim() });
      }
    });
  }

  // Parsează ingredientele prin Smart Text Parser pentru a corela cu db.foods
  const parsedIngredients = await parseRawTextIngredients(rawIngredients.join('\n'));

  // Extragere număr de porții
  let servings = 2;
  if (recipeLd.recipeYield) {
    const yieldStr = String(recipeLd.recipeYield);
    const yieldMatch = yieldStr.match(/\d+/);
    if (yieldMatch) servings = Math.max(1, parseInt(yieldMatch[0], 10));
  }

  return {
    name: recipeName,
    servings,
    ingredients: parsedIngredients.ingredients,
    steps: steps.length > 0 ? steps : parsedIngredients.steps,
    sourceUrl: trimmedUrl,
    estimatedCookedWeight: parsedIngredients.estimatedCookedWeight,
    notes: `Importată din: ${new URL(trimmedUrl).hostname}`,
  };
}

/**
 * Validează și procesează un fișier JSON de backup de rețete.
 */
export function parseRecipeJson(jsonString: string): { single?: unknown; batch?: unknown[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Fișierul nu conține un JSON valid.');
  }

  if (Array.isArray(parsed)) {
    return { batch: parsed };
  } else if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.recipes)) {
      return { batch: obj.recipes };
    }
    return { single: parsed };
  }

  throw new Error('Format JSON nerecunoscut pentru rețete.');
}
