import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { logMealTemplate, deleteMealTemplate } from '../db/operations';
import { MealTemplate, MealType } from '../types/nutrition';

const mealLabels: Record<MealType, string> = {
  breakfast: 'Mic dejun', lunch: 'Prânz', dinner: 'Cină', snack: 'Gustări',
};

interface Props {
  date: string;
  activeMeal: MealType;
  onClose: () => void;
}

export function MealTemplatesModal({ date, activeMeal, onClose }: Props) {
  const templates = useLiveQuery(() => db.mealTemplates.toArray()) ?? [];
  const [targetMeal, setTargetMeal] = useState<MealType>(activeMeal);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleLog = async (template: MealTemplate) => {
    try {
      await logMealTemplate(template, date, targetMeal);
      setSuccessNotice(`Șablonul „${template.name}” a fost adăugat la ${mealLabels[targetMeal]}!`);
      setTimeout(() => {
        setSuccessNotice(null);
        onClose();
      }, 1000);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Ștergi șablonul „${name}”?`)) {
      await deleteMealTemplate(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-lg p-5 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <h2 className="text-base font-bold text-white">Mese Favorite & Șabloane</h2>
          </div>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
          Loghează o combinație de alimente dintr-un singur click la masa dorită.
        </p>

        {/* Selector Masă Destinație */}
        <div className="mb-4 bg-zinc-950 p-2 rounded-xl border border-zinc-800/80">
          <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1.5">Adaugă la masa:</label>
          <div className="flex gap-1.5">
            {(Object.keys(mealLabels) as MealType[]).map((m) => (
              <button
                key={m}
                onClick={() => setTargetMeal(m)}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg border transition ${
                  targetMeal === m
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-bold'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                {mealLabels[m]}
              </button>
            ))}
          </div>
        </div>

        {successNotice && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl mb-3 text-center">
            {successNotice}
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-8 bg-zinc-950/40 border border-zinc-800/60 rounded-2xl p-5">
            <span className="text-3xl block mb-2">🍽️</span>
            <p className="text-xs text-zinc-400 font-semibold mb-1">Nu ai salvat niciun șablon încă.</p>
            <p className="text-[11px] text-zinc-600">
              Poți salva orice masă existentă ca șablon apăsând pe meniul „•••” al acelei mese pe ecranul principal.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {templates.map((tpl) => (
              <li key={tpl.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-white">{tpl.name}</h3>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {tpl.items.length} alimente · masă sugerată: {mealLabels[tpl.mealType] || tpl.mealType}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(tpl.id, tpl.name)}
                    aria-label="Șterge șablon"
                    className="text-zinc-600 hover:text-rose-400 text-sm px-1 leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Listă sumară a ingredientelor */}
                <div className="text-xs text-zinc-400 bg-zinc-900/60 p-2 rounded-lg space-y-0.5 font-mono text-[11px]">
                  {tpl.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span className="truncate max-w-[200px] text-zinc-300">{it.name}</span>
                      <span className="text-zinc-500">{it.amountGrams > 1 ? `${it.amountGrams}g · ` : ''}{it.calories} kcal</span>
                    </div>
                  ))}
                </div>

                {/* Total macros și buton de adăugare */}
                <div className="flex justify-between items-center pt-1 border-t border-zinc-900">
                  <div className="font-mono text-xs">
                    <span className="font-bold text-white">{tpl.totalCalories} kcal</span>
                    <span className="text-zinc-500 text-[10px] ml-2">
                      P:{tpl.totalProtein}g C:{tpl.totalCarbs}g G:{tpl.totalFat}g
                    </span>
                  </div>
                  <button
                    onClick={() => handleLog(tpl)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-lg text-xs transition"
                  >
                    + Loghează
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
