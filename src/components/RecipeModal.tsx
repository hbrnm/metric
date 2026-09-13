import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { saveRecipe, logRecipeByGrams } from '../db/operations';
import { Recipe, MealType } from '../types/nutrition';

interface Props {
  date: string;
  mealType: MealType;
  onClose: () => void;
}

type DraftIngredient = { name: string; rawGrams: string; caloriesPer100: string; proteinPer100: string; carbsPer100: string; fatPer100: string };

const emptyIngredient = (): DraftIngredient => ({
  name: '', rawGrams: '', caloriesPer100: '', proteinPer100: '', carbsPer100: '', fatPer100: '',
});

export function RecipeModal({ date, mealType, onClose }: Props) {
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray()) ?? [];

  // --- Logare rețetă existentă ---
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [grams, setGrams] = useState('200');
  const [logError, setLogError] = useState('');

  const handleLog = async () => {
    if (!selected) return;
    try {
      await logRecipeByGrams({ date, mealType, recipe: selected, grams: parseFloat(grams) || 0 });
      onClose();
    } catch (e) {
      setLogError((e as Error).message);
    }
  };

  // --- Creare rețetă nouă ---
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([emptyIngredient()]);
  const [cookedWeight, setCookedWeight] = useState('');
  const [createError, setCreateError] = useState('');

  const updateIngredient = (idx: number, field: keyof DraftIngredient, value: string) => {
    setIngredients((prev) => prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing)));
  };

  const rawTotal = ingredients.reduce((s, i) => s + (parseFloat(i.rawGrams) || 0), 0);

  const handleCreate = async () => {
    try {
      const parsed = ingredients
        .filter((i) => i.name.trim() && parseFloat(i.rawGrams) > 0)
        .map((i) => ({
          name: i.name.trim(),
          rawGrams: parseFloat(i.rawGrams) || 0,
          caloriesPer100: parseFloat(i.caloriesPer100) || 0,
          proteinPer100: parseFloat(i.proteinPer100) || 0,
          carbsPer100: parseFloat(i.carbsPer100) || 0,
          fatPer100: parseFloat(i.fatPer100) || 0,
        }));

      await saveRecipe({ name, ingredients: parsed, cookedWeightTotal: parseFloat(cookedWeight) || rawTotal });
      setName('');
      setIngredients([emptyIngredient()]);
      setCookedWeight('');
      setCreateError('');
      setMode('list');
    } catch (e) {
      setCreateError((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white">Rețete</h2>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => { setMode('list'); setSelected(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border ${mode === 'list' ? 'bg-zinc-100 text-zinc-950 border-white' : 'bg-zinc-800/60 text-zinc-400 border-transparent'}`}
          >
            Rețetele mele
          </button>
          <button
            onClick={() => setMode('create')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border ${mode === 'create' ? 'bg-zinc-100 text-zinc-950 border-white' : 'bg-zinc-800/60 text-zinc-400 border-transparent'}`}
          >
            + Rețetă nouă
          </button>
        </div>

        {mode === 'list' && (
          selected ? (
            <div className="space-y-4">
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
                <h3 className="text-base font-bold text-white">{selected.name}</h3>
                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-zinc-800/60 font-mono text-center text-xs">
                  <div><span className="text-zinc-500 block">kcal/100g</span><span className="text-white font-bold">{selected.caloriesPer100Cooked}</span></div>
                  <div><span className="text-zinc-500 block">P</span><span className="text-sky-400 font-bold">{selected.proteinPer100Cooked}g</span></div>
                  <div><span className="text-zinc-500 block">C</span><span className="text-amber-400 font-bold">{selected.carbsPer100Cooked}g</span></div>
                  <div><span className="text-zinc-500 block">G</span><span className="text-indigo-400 font-bold">{selected.fatPer100Cooked}g</span></div>
                </div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Porție din farfurie:</span>
                <div className="flex items-center gap-1.5 w-24">
                  <input type="number" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-right font-mono text-sm text-white" />
                  <span className="text-xs text-zinc-500">g</span>
                </div>
              </div>
              {logError && <p className="text-xs text-rose-400">{logError}</p>}
              <button onClick={handleLog} className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm">
                Adaugă în jurnal
              </button>
              <button onClick={() => setSelected(null)} className="w-full h-9 text-zinc-400 text-xs">Înapoi la listă</button>
            </div>
          ) : recipes.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-6 text-center">Nu ai nicio rețetă încă. Creează una din tab-ul alăturat.</p>
          ) : (
            <ul className="space-y-1.5">
              {recipes.map((r) => (
                <li key={r.id} onClick={() => setSelected(r)}
                  className="bg-zinc-950 border border-zinc-800/60 rounded-lg px-3 py-2.5 flex justify-between items-center cursor-pointer hover:bg-zinc-800/40">
                  <span className="text-sm text-zinc-200">{r.name}</span>
                  <span className="font-mono text-xs text-zinc-500">{r.caloriesPer100Cooked} kcal/100g</span>
                </li>
              ))}
            </ul>
          )
        )}

        {mode === 'create' && (
          <div className="space-y-3">
            <input
              placeholder="Nume rețetă (ex. Orez cu pui)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"
            />

            {ingredients.map((ing, idx) => (
              <div key={idx} className="bg-zinc-950 border border-zinc-800/70 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    placeholder="Ingredient (ex. Piept de pui crud)"
                    value={ing.name}
                    onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-100"
                  />
                  <input
                    type="number" inputMode="decimal" placeholder="g crud"
                    value={ing.rawGrams}
                    onChange={(e) => updateIngredient(idx, 'rawGrams', e.target.value)}
                    className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-100 font-mono"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <input type="number" inputMode="decimal" placeholder="kcal/100g" value={ing.caloriesPer100}
                    onChange={(e) => updateIngredient(idx, 'caloriesPer100', e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-[11px] text-zinc-100 font-mono" />
                  <input type="number" inputMode="decimal" placeholder="P/100g" value={ing.proteinPer100}
                    onChange={(e) => updateIngredient(idx, 'proteinPer100', e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-[11px] text-sky-400 font-mono" />
                  <input type="number" inputMode="decimal" placeholder="C/100g" value={ing.carbsPer100}
                    onChange={(e) => updateIngredient(idx, 'carbsPer100', e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-[11px] text-amber-400 font-mono" />
                  <input type="number" inputMode="decimal" placeholder="G/100g" value={ing.fatPer100}
                    onChange={(e) => updateIngredient(idx, 'fatPer100', e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-[11px] text-indigo-400 font-mono" />
                </div>
              </div>
            ))}

            <button
              onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
              className="w-full h-9 bg-zinc-800/60 text-zinc-300 text-xs rounded-lg"
            >
              + Adaugă ingredient
            </button>

            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-300 block">Greutate gătită totală</span>
                <span className="text-[10px] text-zinc-500">Cântărită după fierbere/coacere (crud: {Math.round(rawTotal)}g)</span>
              </div>
              <div className="flex items-center gap-1.5 w-24">
                <input type="number" inputMode="decimal" placeholder={String(Math.round(rawTotal))} value={cookedWeight}
                  onChange={(e) => setCookedWeight(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-right font-mono text-sm text-white" />
                <span className="text-xs text-zinc-500">g</span>
              </div>
            </div>

            {createError && <p className="text-xs text-rose-400">{createError}</p>}

            <button onClick={handleCreate} className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm">
              Salvează rețeta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
