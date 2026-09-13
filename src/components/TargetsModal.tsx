import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { addTarget } from '../db/operations';
import { WeeklyTarget } from '../types/nutrition';

interface Props {
  currentTarget: WeeklyTarget;
  onClose: () => void;
}

export function TargetsModal({ currentTarget, onClose }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [calories, setCalories] = useState(String(currentTarget.calories));
  const [protein, setProtein] = useState(String(currentTarget.protein));
  const [carbs, setCarbs] = useState(String(currentTarget.carbs));
  const [fat, setFat] = useState(String(currentTarget.fat));
  const [error, setError] = useState('');

  const history = useLiveQuery(
    () => db.targets.orderBy('effectiveFrom').reverse().toArray()
  ) ?? [];

  const handleSave = async () => {
    try {
      await addTarget({
        effectiveFrom,
        calories: parseInt(calories, 10),
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white">Obiective</h2>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        <div className="mb-3">
          <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Valabil de la</label>
          <input
            type="date"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Calorii*</label>
            <input type="number" inputMode="numeric" value={calories} onChange={(e) => setCalories(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-emerald-400" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Proteine (g)</label>
            <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-sky-400" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Carbohidrați (g)</label>
            <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-amber-400" />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Grăsimi (g)</label>
            <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-indigo-400" />
          </div>
        </div>

        {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}

        <button onClick={handleSave} className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm mb-5">
          Salvează obiectiv nou
        </button>

        {history.length > 0 && (
          <div>
            <h3 className="text-[10px] uppercase font-bold text-zinc-500 mb-2">Istoric</h3>
            <ul className="space-y-1.5">
              {history.map((t) => (
                <li key={t.id} className="flex justify-between items-center text-xs bg-zinc-950/60 border border-zinc-800/60 rounded-lg px-3 py-2">
                  <span className="text-zinc-400">de la {t.effectiveFrom}</span>
                  <span className="font-mono text-zinc-300">
                    {t.calories} kcal · P{t.protein} C{t.carbs} G{t.fat}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
