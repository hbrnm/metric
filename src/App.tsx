import { useState } from 'react';
import { useDailyLogs } from './hooks/useDailyLogs';
import { useActiveTarget } from './hooks/useActiveTarget';
import { deleteLogEntry } from './db/operations';
import { MealType } from './types/nutrition';
import { QuickLogModal } from './components/QuickLogModal';
import { TargetsModal } from './components/TargetsModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { WeightModal } from './components/WeightModal';
import { RecipeModal } from './components/RecipeModal';
import { BackupModal } from './components/BackupModal';

const mealLabels: Record<MealType, string> = {
  breakfast: 'Mic dejun', lunch: 'Prânz', dinner: 'Cină', snack: 'Gustări',
};
const FALLBACK_TARGET = { id: 'loading', effectiveFrom: '', calories: 2100, protein: 160, carbs: 190, fat: 65 };

export default function App() {
  const today = new Date().toISOString().split('T')[0];
  const { byMeal, totalCalories, totalProtein, totalCarbs, totalFat } = useDailyLogs(today);
  const target = useActiveTarget(today) ?? FALLBACK_TARGET;
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealType>('breakfast');

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24">
      <header className="mb-4 flex justify-between items-center gap-2">
        <h1 className="text-lg font-bold">Astăzi</h1>
        <div className="flex gap-2 flex-wrap justify-end">
          <button
            onClick={() => setShowWeight(true)}
            className="text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg"
          >
            Greutate
          </button>
          <button
            onClick={() => setShowTargets(true)}
            className="text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg"
          >
            Obiective
          </button>
          <button
            onClick={() => setShowBackup(true)}
            className="text-xs text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-lg"
          >
            Backup
          </button>
        </div>
      </header>

      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-2xl font-mono font-bold">{totalCalories}</span>
          <span className="text-sm text-zinc-500">/ {target.calories} kcal</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-400">P</span>
            <span className="font-mono text-sky-400">{totalProtein}/{target.protein}g</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">C</span>
            <span className="font-mono text-amber-400">{totalCarbs}/{target.carbs}g</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">G</span>
            <span className="font-mono text-indigo-400">{totalFat}/{target.fat}g</span>
          </div>
        </div>
      </section>

      {(Object.keys(mealLabels) as MealType[]).map((m) => (
        <section key={m} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-3">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold uppercase text-zinc-400">{mealLabels[m]}</h2>
            <button
              onClick={() => { setActiveMeal(m); setShowQuickLog(true); }}
              className="text-xs text-zinc-400 hover:text-white bg-zinc-800/70 px-2 py-1 rounded-lg"
            >
              + Adaugă
            </button>
          </div>
          {byMeal[m].length === 0 ? (
            <p className="text-xs text-zinc-600 italic">Niciun aliment</p>
          ) : (
            <ul className="space-y-1">
              {byMeal[m].map((entry) => (
                <li key={entry.id} className="flex justify-between items-center text-sm">
                  <span>{entry.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-zinc-400">{entry.calories} kcal</span>
                    <button
                      onClick={() => deleteLogEntry(entry.id)}
                      aria-label={`Șterge ${entry.name}`}
                      className="text-zinc-600 hover:text-rose-400 text-xs px-1"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <nav className="fixed bottom-0 inset-x-0 bg-zinc-950/90 border-t border-zinc-800 px-4 py-3">
        <div className="max-w-md mx-auto flex gap-2">
          <button
            onClick={() => { setActiveMeal('breakfast'); setShowScanner(true); }}
            className="flex-1 h-12 bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold rounded-xl text-sm"
          >
            Scanare
          </button>
          <button
            onClick={() => { setActiveMeal('breakfast'); setShowRecipes(true); }}
            className="flex-1 h-12 bg-zinc-900 border border-zinc-800 text-zinc-200 font-semibold rounded-xl text-sm"
          >
            Rețete
          </button>
          <button
            onClick={() => { setActiveMeal('breakfast'); setShowQuickLog(true); }}
            className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm"
          >
            Rapid
          </button>
        </div>
      </nav>

      {showQuickLog && (
        <QuickLogModal
          date={today}
          initialMeal={activeMeal}
          onClose={() => setShowQuickLog(false)}
        />
      )}

      {showTargets && (
        <TargetsModal
          currentTarget={target}
          onClose={() => setShowTargets(false)}
        />
      )}

      {showScanner && (
        <BarcodeScannerModal
          date={today}
          mealType={activeMeal}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showWeight && (
        <WeightModal
          date={today}
          onClose={() => setShowWeight(false)}
        />
      )}

      {showRecipes && (
        <RecipeModal
          date={today}
          mealType={activeMeal}
          onClose={() => setShowRecipes(false)}
        />
      )}

      {showBackup && (
        <BackupModal onClose={() => setShowBackup(false)} />
      )}
    </div>
  );
}
