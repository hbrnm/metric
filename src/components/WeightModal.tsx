import { useState } from 'react';
import { logWeightEntry } from '../db/operations';
import { useWeightData } from '../hooks/useWeightData';

interface Props {
  date: string;
  onClose: () => void;
}

export function WeightModal({ date, onClose }: Props) {
  const [weightInput, setWeightInput] = useState('');
  const [error, setError] = useState('');
  const { history, analysis } = useWeightData();

  const todayEntry = history.find((w) => w.date === date);

  const handleSave = async () => {
    try {
      await logWeightEntry(date, parseFloat(weightInput));
      setWeightInput('');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white">Greutate și TDEE</h2>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 mb-4">
          <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-2">
            {todayEntry ? `Azi: ${todayEntry.weightKg} kg` : 'Greutate azi'}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="ex. 78.4"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 font-mono text-xl font-bold text-white"
            />
            <span className="text-zinc-500 font-bold text-sm">kg</span>
            <button
              onClick={handleSave}
              disabled={!weightInput}
              className="h-11 px-4 bg-emerald-500 disabled:opacity-30 text-zinc-950 font-bold rounded-xl text-xs"
            >
              Salvează
            </button>
          </div>
          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
          <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-2">
            Analiză metabolică (ultimele 21 zile)
          </span>
          {analysis.isReliable ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Consum real estimat (TDEE):</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{analysis.tdee} kcal</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Aport caloric mediu:</span>
                <span className="font-mono text-zinc-200">{analysis.averageIntake} kcal/zi</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Evoluție trend:</span>
                <span className="font-mono text-zinc-200">
                  {(analysis.weeklyWeightDelta ?? 0) > 0 ? '+' : ''}{analysis.weeklyWeightDelta} kg/săpt
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 leading-relaxed">{analysis.reason}</p>
          )}
        </div>
      </div>
    </div>
  );
}
