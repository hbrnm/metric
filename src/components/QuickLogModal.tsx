import { useState } from 'react';
import { addLogEntry } from '../db/operations';
import { MealType } from '../types/nutrition';

const mealLabels: Record<MealType, string> = {
  breakfast: 'Mic dejun', lunch: 'Prânz', dinner: 'Cină', snack: 'Gustări',
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

  const handleSave = async () => {
    try {
      await addLogEntry({
        date,
        mealType: meal,
        name: name.trim() || 'Înregistrare rapidă',
        calories: parseInt(calories, 10),
        protein: protein ? parseFloat(protein) : 0,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white">Adăugare rapidă</h2>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        <div className="flex gap-2 mb-4">
          {(Object.keys(mealLabels) as MealType[]).map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${
                meal === m ? 'bg-zinc-100 text-zinc-950 border-white' : 'bg-zinc-800/60 text-zinc-400 border-transparent'
              }`}
            >
              {mealLabels[m]}
            </button>
          ))}
        </div>

        <input
          placeholder="Descriere (ex. Prânz cantină)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 mb-3"
        />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Calorii*</label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-lg font-mono font-bold text-emerald-400"
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
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-lg font-mono font-bold text-sky-400"
            />
          </div>
        </div>

        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm"
        >
          Salvează
        </button>
      </div>
    </div>
  );
}
