import { useState, useEffect } from 'react';
import { addLogEntry, getFrequentFoodsForMeal, FrequentFoodSuggestion } from '../db/operations';
import { MealType } from '../types/nutrition';

const mealLabels: Record<MealType, string> = {
  breakfast: 'Mic dejun',
  lunch: 'Prânz',
  dinner: 'Cină',
  snack: 'Gustări',
};

interface Props {
  date: string;
  initialMeal: MealType;
  onClose: () => void;
}

export function QuickLogModal({ date, initialMeal, onClose }: Props) {
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<FrequentFoodSuggestion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Încărcare sugestii inteligente la schimbarea mesei
  useEffect(() => {
    let cancelled = false;
    getFrequentFoodsForMeal(meal, 4).then((res) => {
      if (!cancelled) setSuggestions(res);
    });
    return () => {
      cancelled = true;
    };
  }, [meal]);

  // Logare directă cu 1 tap din chip-ul de sugestie
  const handleQuickAdd = async (s: FrequentFoodSuggestion) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addLogEntry({
        date,
        mealType: meal,
        name: s.name,
        calories: s.calories,
        protein: s.protein,
        carbs: s.carbs,
        fat: s.fat,
        amountGrams: s.amountGrams,
        foodId: s.foodId,
        recipeId: s.recipeId,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setIsSubmitting(false);
    }
  };

  // Pre-completare în formular dacă utilizatorul vrea să ajusteze
  const handlePopulateForm = (s: FrequentFoodSuggestion) => {
    setName(s.name);
    setCalories(String(s.calories));
    setProtein(s.protein ? String(s.protein) : '');
  };

  const handleSave = async () => {
    if (isSubmitting) return;
    setError('');
    const parsedCalories = parseInt(calories, 10);
    if (!Number.isFinite(parsedCalories) || parsedCalories <= 0) {
      setError('Te rugăm să introduci un număr pozitiv valid de calorii.');
      return;
    }

    const parsedProtein = protein ? parseFloat(protein) : 0;
    if (protein && (!Number.isFinite(parsedProtein) || parsedProtein < 0)) {
      setError('Proteinele trebuie să fie un număr valid (sau lasă gol).');
      return;
    }

    setIsSubmitting(true);
    try {
      await addLogEntry({
        date,
        mealType: meal,
        name: name.trim() || 'Înregistrare rapidă',
        calories: parsedCalories,
        protein: parsedProtein,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h2 className="text-base font-bold text-white">Adăugare rapidă</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="text-zinc-400 hover:text-white text-xl leading-none px-1"
          >
            ×
          </button>
        </div>

        {/* Selector tip masă */}
        <div className="flex gap-2 mb-4">
          {(Object.keys(mealLabels) as MealType[]).map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${
                meal === m
                  ? 'bg-zinc-100 text-zinc-950 border-white'
                  : 'bg-zinc-800/60 text-zinc-400 border-transparent hover:text-zinc-200'
              }`}
            >
              {mealLabels[m]}
            </button>
          ))}
        </div>

        {/* Sugestii inteligente (cele mai frecvente alimente mâncate) */}
        {suggestions.length > 0 && (
          <div className="mb-4 bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
                <span>⚡</span> Frecvente la {mealLabels[meal]} (1 tap = logat)
              </span>
              <span className="text-[10px] text-zinc-500">Apasă pentru logare</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm group hover:border-emerald-500/50 transition"
                >
                  <button
                    type="button"
                    onClick={() => handleQuickAdd(s)}
                    disabled={isSubmitting}
                    className="px-2.5 py-1.5 text-xs text-left font-medium text-zinc-200 group-hover:text-emerald-400 transition flex items-center gap-1.5"
                    title={`Apasă pentru a adăuga instant: ${s.name} (${s.calories} kcal, ${s.protein}g P)`}
                  >
                    <span>+</span>
                    <span className="truncate max-w-[140px]">{s.name}</span>
                    <span className="font-mono text-[11px] text-emerald-400 font-bold">{s.calories} kcal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePopulateForm(s)}
                    className="px-2 py-1.5 text-zinc-500 hover:text-white border-l border-zinc-800/60 transition text-[11px]"
                    title="Ajustează cantitatea în formular"
                  >
                    ✎
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formular manual */}
        <div className="space-y-3">
          <input
            placeholder="Descriere aliment (ex. Prânz cantină, Banană)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Calorii*</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-lg font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Proteine (g)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={protein}
                onChange={(e) => setProtein(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-lg font-mono font-bold text-sky-400 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

          <button
            onClick={handleSave}
            disabled={isSubmitting || !calories}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 text-zinc-950 font-bold rounded-xl text-sm transition mt-2 shadow-lg shadow-emerald-500/10 active:scale-95"
          >
            {isSubmitting ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>
      </div>
    </div>
  );
}
