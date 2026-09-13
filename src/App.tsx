import { useState, useEffect } from 'react';
import { useDailyLogs } from './hooks/useDailyLogs';
import { useActiveTarget } from './hooks/useActiveTarget';
import {
  deleteLogEntry,
  toggleLogEntryStatus,
  bulkDeleteLogs,
  bulkMoveLogs,
  saveMealAsTemplate,
  seedInitialFoodsIfNeeded,
} from './db/operations';
import { MealType, LogEntry } from './types/nutrition';
import { QuickLogModal } from './components/QuickLogModal';
import { TargetsModal } from './components/TargetsModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { WeightModal } from './components/WeightModal';
import { RecipeModal } from './components/RecipeModal';
import { BackupModal } from './components/BackupModal';
import { WaterTrackerCard } from './components/WaterTrackerCard';
import { MealTemplatesModal } from './components/MealTemplatesModal';
import { CopyDayModal } from './components/CopyDayModal';
import { ExportDiaryModal } from './components/ExportDiaryModal';
import { FoodSearchModal } from './components/FoodSearchModal';
import { WeeklySummaryModal } from './components/WeeklySummaryModal';
import { getLocalDateString, shiftDate, formatDisplayDate } from './utils/date';

const mealLabels: Record<MealType, string> = {
  breakfast: 'Mic dejun', lunch: 'Prânz', dinner: 'Cină', snack: 'Gustări',
};
const FALLBACK_TARGET = { id: 'default', effectiveFrom: '', calories: 2100, protein: 160, carbs: 190, fat: 65 };

export default function App() {
  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);

  const {
    byMeal,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    plannedCalories,
    hasPlanned,
  } = useDailyLogs(selectedDate);

  const target = useActiveTarget(selectedDate) ?? FALLBACK_TARGET;

  // Stări modale existente
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealType>('breakfast');

  // Stare nouă: Căutare Alimente în Catalog
  const [showFoodSearch, setShowFoodSearch] = useState(false);

  // Stări noi: Șabloane, Copiere zi, Export, Rezumat
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCopyDay, setShowCopyDay] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);

  // Scurtături PWA & Deep-link: verificare acțiune din query params la deschidere + seed alimente
  useEffect(() => {
    seedInitialFoodsIfNeeded().catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'quicklog') {
      setShowQuickLog(true);
    } else if (action === 'search') {
      setShowFoodSearch(true);
    } else if (action === 'weight') {
      setShowWeight(true);
    }
    if (action) {
      // Curățăm discret parametrul din URL pentru a păstra istoricul curat
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Acțiuni în masă pe mese
  const [bulkMeal, setBulkMeal] = useState<MealType | null>(null);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);

  // Meniu contextual per masă
  const [activeMealMenu, setActiveMealMenu] = useState<MealType | null>(null);

  const isToday = selectedDate === today;

  // Calcule procente calorii & macro
  const calPercent = Math.min(100, Math.round((totalCalories / (target.calories || 1)) * 100));
  const remainingCals = target.calories - totalCalories;
  const proteinPercent = Math.min(100, Math.round((totalProtein / (target.protein || 1)) * 100));
  const carbsPercent = Math.min(100, Math.round((totalCarbs / (target.carbs || 1)) * 100));
  const fatPercent = Math.min(100, Math.round((totalFat / (target.fat || 1)) * 100));

  // Handlers selecție masă
  const toggleSelectLog = (id: string) => {
    setSelectedLogIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleBulkDelete = async () => {
    if (confirm(`Ștergi ${selectedLogIds.length} alimente selectate?`)) {
      await bulkDeleteLogs(selectedLogIds);
      setSelectedLogIds([]);
      setBulkMeal(null);
    }
  };

  const handleBulkMove = async (destMeal: MealType) => {
    await bulkMoveLogs(selectedLogIds, destMeal);
    setSelectedLogIds([]);
    setBulkMeal(null);
    setMoveMenuOpen(false);
  };

  const handleSaveAsTemplate = async (m: MealType) => {
    const items = byMeal[m];
    if (items.length === 0) return;
    const defaultName = `${mealLabels[m]} favorit`;
    const templateName = prompt('Introdu un nume pentru acest șablon de masă:', defaultName);
    if (!templateName || !templateName.trim()) return;

    try {
      await saveMealAsTemplate(templateName.trim(), m, items);
      alert(`Șablonul „${templateName.trim()}” a fost salvat cu succes!`);
      setActiveMealMenu(null);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24 max-w-lg mx-auto">
      {/* Header cu butoane modale și navigație superioară */}
      <header className="mb-3 flex justify-between items-center gap-2">
        <span className="text-xs font-bold tracking-wider uppercase text-emerald-500">Metric</span>
        <div className="flex gap-1.5 flex-wrap justify-end text-[11px]">
          <button
            onClick={() => setShowTemplates(true)}
            className="text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg transition"
            title="Mese Favorite"
          >
            ⭐ Șabloane
          </button>
          <button
            onClick={() => setShowCopyDay(true)}
            className="text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg transition"
            title="Copiază zi"
          >
            📋 Copiază
          </button>
          <button
            onClick={() => setShowWeeklySummary(true)}
            className="text-emerald-400 hover:text-emerald-300 bg-zinc-900 border border-emerald-500/40 px-2 py-1 rounded-lg transition font-semibold"
            title="Rezumat & Analiză Săptămânală"
          >
            📊 Rezumat
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg transition"
            title="Export Raport"
          >
            📋 Export
          </button>
          <button
            onClick={() => setShowWeight(true)}
            className="text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg transition"
          >
            Greutate
          </button>
          <button
            onClick={() => setShowTargets(true)}
            className="text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg transition"
          >
            Obiective
          </button>
          <button
            onClick={() => setShowBackup(true)}
            className="text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg transition"
          >
            Backup
          </button>
        </div>
      </header>

      {/* Selector Navigare între Zile */}
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-2xl p-2 mb-4">
        <button
          onClick={() => setSelectedDate((prev) => shiftDate(prev, -1))}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white transition"
          aria-label="Ziua anterioară"
        >
          ‹
        </button>
        <div className="text-center">
          <h1 className="text-base font-bold text-white flex items-center justify-center gap-2">
            {formatDisplayDate(selectedDate)}
            {!isToday && (
              <button
                onClick={() => setSelectedDate(today)}
                className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono hover:bg-emerald-500/30 transition"
              >
                Azi
              </button>
            )}
          </h1>
          <span className="text-[11px] font-mono text-zinc-500">{selectedDate}</span>
        </div>
        <button
          onClick={() => setSelectedDate((prev) => shiftDate(prev, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white transition"
          aria-label="Ziua următoare"
        >
          ›
        </button>
      </div>

      {/* Card Rezumat Calorii & Macronutrienți cu Bare Dinamice de Progres */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4 space-y-3">
        <div className="flex justify-between items-baseline">
          <div>
            <span className="text-3xl font-mono font-bold text-white">{totalCalories}</span>
            <span className="text-xs text-zinc-500 ml-1.5">kcal consumate</span>
            {hasPlanned && (
              <span className="text-xs text-amber-400/90 font-mono ml-2 font-semibold">
                (+{plannedCalories} planif.)
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-sm font-mono text-zinc-400">/ {target.calories} kcal</span>
            <span
              className={`block text-[11px] font-mono font-semibold ${
                remainingCals >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {remainingCals >= 0 ? `${remainingCals} kcal rămase` : `+${Math.abs(remainingCals)} kcal peste țintă`}
            </span>
          </div>
        </div>

        {/* Bară de progres calorii */}
        <div className="w-full bg-zinc-950 rounded-full h-2.5 overflow-hidden border border-zinc-800/80">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${
              remainingCals >= 0 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-rose-500'
            }`}
            style={{ width: `${calPercent}%` }}
          />
        </div>

        {/* Bare și valori Macronutrienți P / C / G */}
        <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-zinc-800/70">
          {/* Proteine */}
          <div className="bg-zinc-950/70 p-2 rounded-xl border border-zinc-800/50 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-bold">P</span>
              <span className="font-mono text-sky-400 text-[11px] font-semibold">{totalProtein}/{target.protein}g</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div className="bg-sky-400 h-1.5 rounded-full" style={{ width: `${proteinPercent}%` }} />
            </div>
          </div>

          {/* Carbohidrați */}
          <div className="bg-zinc-950/70 p-2 rounded-xl border border-zinc-800/50 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-bold">C</span>
              <span className="font-mono text-amber-400 text-[11px] font-semibold">{totalCarbs}/{target.carbs}g</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div className="bg-amber-400 h-1.5 rounded-full" style={{ width: `${carbsPercent}%` }} />
            </div>
          </div>

          {/* Grăsimi */}
          <div className="bg-zinc-950/70 p-2 rounded-xl border border-zinc-800/50 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-bold">G</span>
              <span className="font-mono text-indigo-400 text-[11px] font-semibold">{totalFat}/{target.fat}g</span>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
              <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${fatPercent}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* Widget Urmărire Hidratare (Water Tracker) */}
      <WaterTrackerCard date={selectedDate} />

      {/* Secțiuni Mese Zilnice */}
      {(Object.keys(mealLabels) as MealType[]).map((m) => {
        const mealItems = byMeal[m];
        const mealCalories = mealItems.reduce((s, i) => s + (i.status === 'consumed' ? i.calories : 0), 0);
        const isBulk = bulkMeal === m;

        return (
          <section key={m} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-3 relative">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">{mealLabels[m]}</h2>
                {mealCalories > 0 && (
                  <span className="text-[11px] font-mono text-zinc-500 font-semibold">{mealCalories} kcal</span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setActiveMeal(m); setShowFoodSearch(true); }}
                  className="text-xs text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 px-2.5 py-1 rounded-lg transition font-medium"
                >
                  🔍 Caută
                </button>
                <button
                  onClick={() => { setActiveMeal(m); setShowQuickLog(true); }}
                  className="text-xs text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 px-2 py-1 rounded-lg transition font-medium"
                  title="Adăugare rapidă calorii"
                >
                  + Rapid
                </button>
                {/* Meniu Acțiuni Masă */}
                <button
                  onClick={() => setActiveMealMenu(activeMealMenu === m ? null : m)}
                  className="text-xs text-zinc-400 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 px-2 py-1 rounded-lg transition"
                  title="Opțiuni masă"
                >
                  •••
                </button>
              </div>
            </div>

            {/* Dropdown Meniu Contextual Masă */}
            {activeMealMenu === m && (
              <div className="bg-zinc-950 border border-zinc-700 p-1.5 rounded-xl shadow-xl mb-3 space-y-1 text-xs">
                {mealItems.length > 0 && (
                  <button
                    onClick={() => handleSaveAsTemplate(m)}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-200 flex items-center gap-2"
                  >
                    <span>⭐</span>
                    <span>Salvează ca Șablon ({mealItems.length} alimente)</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setActiveMeal(m);
                    setShowTemplates(true);
                    setActiveMealMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-200 flex items-center gap-2"
                >
                  <span>📋</span>
                  <span>Încarcă din Șabloane Favorite</span>
                </button>
                {mealItems.length > 0 && (
                  <button
                    onClick={() => {
                      setBulkMeal(isBulk ? null : m);
                      setSelectedLogIds([]);
                      setActiveMealMenu(null);
                    }}
                    className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-200 flex items-center gap-2"
                  >
                    <span>☑️</span>
                    <span>{isBulk ? 'Anulează Selecția' : 'Selectare Multiplă (Acțiuni în Masă)'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Bară Acțiuni în Masă pe Masă */}
            {isBulk && selectedLogIds.length > 0 && (
              <div className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl flex items-center justify-between text-xs mb-2">
                <span className="text-zinc-300 font-semibold">{selectedLogIds.length} selectate</span>
                <div className="flex gap-1.5 relative">
                  <button
                    onClick={() => setMoveMenuOpen(!moveMenuOpen)}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px]"
                  >
                    Mută la...
                  </button>
                  {moveMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 z-30 bg-zinc-900 border border-zinc-700 rounded-xl p-1 shadow-xl space-y-1">
                      {(Object.keys(mealLabels) as MealType[])
                        .filter((dest) => dest !== m)
                        .map((dest) => (
                          <button
                            key={dest}
                            onClick={() => handleBulkMove(dest)}
                            className="w-full text-left px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-800 rounded-lg"
                          >
                            {mealLabels[dest]}
                          </button>
                        ))}
                    </div>
                  )}
                  <button
                    onClick={handleBulkDelete}
                    className="px-2 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[11px]"
                  >
                    Șterge
                  </button>
                </div>
              </div>
            )}

            {/* Listă Alimente Masă */}
            {mealItems.length === 0 ? (
              <p className="text-xs text-zinc-600 italic py-1">Niciun aliment înregistrat</p>
            ) : (
              <ul className="space-y-1.5 pt-1">
                {mealItems.map((entry) => {
                  const isConsumed = (entry.status || 'consumed') === 'consumed';

                  return (
                    <li
                      key={entry.id}
                      className={`flex justify-between items-center text-sm py-1.5 px-2 rounded-xl border transition ${
                        isConsumed
                          ? 'bg-zinc-950/40 border-zinc-800/40'
                          : 'bg-amber-500/5 border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {isBulk ? (
                          <input
                            type="checkbox"
                            checked={selectedLogIds.includes(entry.id)}
                            onChange={() => toggleSelectLog(entry.id)}
                            className="accent-emerald-500 rounded"
                          />
                        ) : (
                          /* Buton comutare status Consumat / Planificat */
                          <button
                            onClick={() => toggleLogEntryStatus(entry.id, entry.status || 'consumed')}
                            title={isConsumed ? 'Marchează ca planificat' : 'Marchează ca consumat'}
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center text-[10px] transition ${
                              isConsumed
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500'
                            }`}
                          >
                            {isConsumed ? '✓' : '○'}
                          </button>
                        )}

                        <div className="flex flex-col min-w-0">
                          <span className={`truncate text-xs ${isConsumed ? 'text-zinc-200' : 'text-zinc-400 italic'}`}>
                            {entry.name}
                            {!isConsumed && <span className="ml-1.5 text-[9px] text-amber-400 font-mono">planificat</span>}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {entry.amountGrams > 1 ? `${entry.amountGrams}g · ` : ''}
                            P:{entry.protein}g C:{entry.carbs}g G:{entry.fat}g
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-2">
                        <span className="font-mono text-xs font-semibold text-zinc-300 whitespace-nowrap">
                          {entry.calories} kcal
                        </span>
                        <button
                          onClick={() => deleteLogEntry(entry.id)}
                          aria-label={`Șterge ${entry.name}`}
                          className="text-zinc-600 hover:text-rose-400 text-sm px-1 leading-none transition"
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      {/* Bara de acțiuni inferioară */}
      <nav className="fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur border-t border-zinc-800 px-3 py-3 z-40">
        <div className="max-w-lg mx-auto flex gap-2">
          <button
            onClick={() => { setActiveMeal('breakfast'); setShowFoodSearch(true); }}
            className="flex-1 h-12 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-200 font-semibold rounded-xl text-xs sm:text-sm transition flex flex-col items-center justify-center gap-0.5"
          >
            <span className="text-sm">🔍</span>
            <span className="text-[11px] font-medium">Caută</span>
          </button>
          <button
            onClick={() => { setActiveMeal('breakfast'); setShowScanner(true); }}
            className="flex-1 h-12 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-200 font-semibold rounded-xl text-xs sm:text-sm transition flex flex-col items-center justify-center gap-0.5"
          >
            <span className="text-sm">📷</span>
            <span className="text-[11px] font-medium">Scanare</span>
          </button>
          <button
            onClick={() => { setActiveMeal('breakfast'); setShowRecipes(true); }}
            className="flex-1 h-12 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-200 font-semibold rounded-xl text-xs sm:text-sm transition flex flex-col items-center justify-center gap-0.5"
          >
            <span className="text-sm">🍲</span>
            <span className="text-[11px] font-medium">Rețete</span>
          </button>
          <button
            onClick={() => { setActiveMeal('breakfast'); setShowQuickLog(true); }}
            className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs sm:text-sm transition shadow-lg shadow-emerald-950/40 flex flex-col items-center justify-center gap-0.5"
          >
            <span className="text-sm font-bold">⚡</span>
            <span className="text-[11px] font-bold">+ Rapid</span>
          </button>
        </div>
      </nav>

      {/* Modale */}
      {showFoodSearch && (
        <FoodSearchModal
          date={selectedDate}
          initialMeal={activeMeal}
          onClose={() => setShowFoodSearch(false)}
        />
      )}

      {showQuickLog && (
        <QuickLogModal
          date={selectedDate}
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
          date={selectedDate}
          mealType={activeMeal}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showWeight && (
        <WeightModal
          date={selectedDate}
          onClose={() => setShowWeight(false)}
        />
      )}

      {showRecipes && (
        <RecipeModal
          date={selectedDate}
          mealType={activeMeal}
          onClose={() => setShowRecipes(false)}
        />
      )}

      {showBackup && (
        <BackupModal onClose={() => setShowBackup(false)} />
      )}

      {showTemplates && (
        <MealTemplatesModal
          date={selectedDate}
          activeMeal={activeMeal}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showCopyDay && (
        <CopyDayModal
          targetDate={selectedDate}
          onClose={() => setShowCopyDay(false)}
          onCopied={() => {}}
        />
      )}

      {showExport && (
        <ExportDiaryModal
          onClose={() => setShowExport(false)}
        />
      )}

      {showWeeklySummary && (
        <WeeklySummaryModal
          onClose={() => setShowWeeklySummary(false)}
        />
      )}
    </div>
  );
}
