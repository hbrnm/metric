import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { logFoodByGrams, seedInitialFoodsIfNeeded } from '../db/operations';
import { searchFoodOnline } from '../services/foodApi';
import { FoodItem, MealType } from '../types/nutrition';

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

export function FoodSearchModal({ date, initialMeal, onClose }: Props) {
  const [meal, setMeal] = useState<MealType>(initialMeal);
  const [query, setQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState('100');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Online search state
  const [onlineResults, setOnlineResults] = useState<FoodItem[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [activeSource, setActiveSource] = useState<'local' | 'online'>('local');

  // Populează automat baza de date cu alimentele românești de bază dacă tabela e goală
  useEffect(() => {
    seedInitialFoodsIfNeeded().catch(() => {});
  }, []);

  // Preluăm toate alimentele din tabela foods din Dexie
  const foods = useLiveQuery(() => db.foods.toArray()) ?? [];

  // Filtrare live locală după nume (case-insensitive, substring match)
  const localResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Dacă nu există căutare, afișăm cele mai recente 10 produse salvate/adăugate
      return foods.slice(-10).reverse();
    }
    return foods.filter((f) => f.name.toLowerCase().includes(q));
  }, [foods, query]);

  const handleOnlineSearch = async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setIsSearchingOnline(true);
    setActiveSource('online');
    try {
      const results = await searchFoodOnline(q, 12);
      setOnlineResults(results);
    } catch {
      setOnlineResults([]);
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleSelectFood = async (item: FoodItem) => {
    // Dacă alimentul provine din căutarea online, îl salvăm în Dexie pentru utilizare offline viitoare
    try {
      const existing = item.barcode
        ? await db.foods.where('barcode').equals(item.barcode).first()
        : null;
      if (!existing) {
        await db.foods.put(item);
      }
    } catch {
      // Ignore cache put errors
    }
    setSelectedFood(item);
    setGrams('100');
    setError('');
  };

  const handleSave = async () => {
    if (!selectedFood) return;
    setError('');
    const parsedGrams = parseFloat(grams);
    if (!Number.isFinite(parsedGrams) || parsedGrams <= 0) {
      setError('Te rugăm să introduci un gramaj pozitiv valid.');
      return;
    }

    setSaving(true);
    try {
      await logFoodByGrams({
        date,
        mealType: meal,
        food: selectedFood,
        grams: parsedGrams,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const currentGrams = parseFloat(grams) || 0;
  const ratio = currentGrams / 100;
  const calcCals = selectedFood ? Math.round(selectedFood.caloriesPer100 * ratio) : 0;
  const calcP = selectedFood ? Math.round(selectedFood.proteinPer100 * ratio * 10) / 10 : 0;
  const calcC = selectedFood ? Math.round(selectedFood.carbsPer100 * ratio * 10) / 10 : 0;
  const calcF = selectedFood ? Math.round(selectedFood.fatPer100 * ratio * 10) / 10 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔍</span>
            <h2 className="text-base font-bold text-white">
              {selectedFood ? 'Cantitate aliment' : 'Catalog Alimente'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Închide"
            className="text-zinc-400 hover:text-white text-xl leading-none px-1"
          >
            ×
          </button>
        </div>

        {/* Selector masă */}
        <div className="flex gap-2 mb-4">
          {(Object.keys(mealLabels) as MealType[]).map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${
                meal === m
                  ? 'bg-zinc-100 text-zinc-950 border-white'
                  : 'bg-zinc-800/60 text-zinc-400 border-transparent'
              }`}
            >
              {mealLabels[m]}
            </button>
          ))}
        </div>

        {selectedFood ? (
          /* Ecran detaliu cantitate și macro-nutrienți */
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
              <h3 className="text-base font-bold text-white leading-tight">{selectedFood.name}</h3>
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-zinc-800/60 font-mono text-center text-xs">
                <div>
                  <span className="text-zinc-500 block">kcal/100g</span>
                  <span className="text-white font-bold">{selectedFood.caloriesPer100}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">P</span>
                  <span className="text-sky-400 font-bold">{selectedFood.proteinPer100}g</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">C</span>
                  <span className="text-amber-400 font-bold">{selectedFood.carbsPer100}g</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">G</span>
                  <span className="text-indigo-400 font-bold">{selectedFood.fatPer100}g</span>
                </div>
              </div>
            </div>

            {/* Input gramaj */}
            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-300 block">Cantitate consumată:</span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {calcCals} kcal · P:{calcP}g C:{calcC}g G:{calcF}g
                </span>
              </div>
              <div className="flex items-center gap-1.5 w-28">
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  autoFocus
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-right font-mono text-sm text-white focus:border-emerald-500/80 outline-none"
                />
                <span className="text-xs text-zinc-500">g</span>
              </div>
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-sm transition"
            >
              {saving ? 'Se salvează...' : `Adaugă la ${mealLabels[meal]} (${calcCals} kcal)`}
            </button>

            <button
              onClick={() => {
                setSelectedFood(null);
                setError('');
              }}
              className="w-full h-8 text-zinc-400 text-xs hover:text-white"
            >
              ← Înapoi la căutare
            </button>
          </div>
        ) : (
          /* Ecran căutare live */
          <div className="space-y-3">
            {/* Input căutare */}
            <div className="relative">
              <input
                type="text"
                autoFocus
                placeholder="Caută aliment (ex: mămăligă, piept pui, iaurt)..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (activeSource === 'online') {
                    setActiveSource('local');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleOnlineSearch();
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500/60"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    setActiveSource('local');
                    setOnlineResults([]);
                  }}
                  className="absolute right-3 top-2.5 text-zinc-500 hover:text-white text-sm"
                >
                  ×
                </button>
              )}
            </div>

            {/* Sursă date: Catalog local vs Online */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setActiveSource('local')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                    activeSource === 'local'
                      ? 'bg-zinc-800 text-white border-zinc-700'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800/80 hover:text-zinc-300'
                  }`}
                >
                  🇷🇴 Catalog Local ({foods.length})
                </button>
                <button
                  onClick={() => {
                    if (query.trim().length >= 2 && activeSource !== 'online') {
                      handleOnlineSearch();
                    } else {
                      setActiveSource('online');
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                    activeSource === 'online'
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                      : 'bg-zinc-950 text-zinc-500 border-zinc-800/80 hover:text-zinc-300'
                  }`}
                >
                  🌐 Caută Online
                  {isSearchingOnline && (
                    <span className="w-2.5 h-2.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              </div>

              {query.trim().length >= 2 && activeSource === 'local' && (
                <button
                  onClick={handleOnlineSearch}
                  className="text-[11px] text-emerald-400 hover:underline font-medium"
                >
                  Caută pe net ↗
                </button>
              )}
            </div>

            {/* Afișare rezultate */}
            {activeSource === 'local' ? (
              /* REZULTATE LOCALE */
              localResults.length === 0 ? (
                <div className="text-center py-8 bg-zinc-950/40 border border-zinc-800/40 rounded-2xl p-5 space-y-3">
                  <span className="text-2xl block">🔍</span>
                  <p className="text-xs text-zinc-400 font-semibold">
                    Nu am găsit „{query}” în catalogul local
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    Baza de date conține alimente de bază din România și produsele salvate de tine.
                  </p>
                  {query.trim().length >= 2 && (
                    <button
                      onClick={handleOnlineSearch}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs transition"
                    >
                      Caută în Open Food Facts Online 🌐
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase font-bold tracking-wider px-1 mb-1.5">
                    <span>{query.trim() ? `Rezultate locale (${localResults.length})` : 'Catalog & Recente'}</span>
                    <span>kcal/100g</span>
                  </div>
                  <ul className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
                    {localResults.map((f) => (
                      <li
                        key={f.id}
                        onClick={() => handleSelectFood(f)}
                        className="bg-zinc-950 border border-zinc-800/60 hover:border-emerald-500/50 hover:bg-zinc-850/50 rounded-xl p-3 flex justify-between items-center cursor-pointer transition"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-sm text-zinc-100 font-medium truncate">{f.name}</span>
                          <span className="text-[11px] text-zinc-500 font-mono">
                            P:{f.proteinPer100}g · C:{f.carbsPer100}g · G:{f.fatPer100}g
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-mono text-xs font-bold text-emerald-400 whitespace-nowrap">
                            {f.caloriesPer100} kcal
                          </span>
                          <span className="text-zinc-600 text-xs">›</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ) : (
              /* REZULTATE ONLINE */
              <div>
                <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase font-bold tracking-wider px-1 mb-1.5">
                  <span>Rezultate Open Food Facts ({onlineResults.length})</span>
                  <span>kcal/100g</span>
                </div>

                {isSearchingOnline ? (
                  <div className="py-12 text-center text-zinc-400 text-xs flex flex-col items-center gap-2">
                    <span className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>Se caută în baza de date alimentară din România...</span>
                  </div>
                ) : onlineResults.length === 0 ? (
                  <div className="text-center py-8 bg-zinc-950/40 border border-zinc-800/40 rounded-2xl p-5 space-y-2">
                    <p className="text-xs text-zinc-400">
                      {query.trim().length < 2
                        ? 'Tastează cel puțin 2 litere și apasă pe Caută Online.'
                        : `Niciun rezultat găsit online pentru „${query}”.`}
                    </p>
                    {query.trim().length >= 2 && (
                      <button
                        onClick={handleOnlineSearch}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold"
                      >
                        Reîncearcă căutarea online 🔄
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="space-y-1.5 max-h-[46vh] overflow-y-auto pr-1">
                    {onlineResults.map((f) => (
                      <li
                        key={f.id}
                        onClick={() => handleSelectFood(f)}
                        className="bg-zinc-950 border border-zinc-800/60 hover:border-emerald-500/50 hover:bg-zinc-850/50 rounded-xl p-3 flex justify-between items-center cursor-pointer transition"
                      >
                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded font-mono">
                              ONLINE
                            </span>
                            <span className="text-sm text-zinc-100 font-medium truncate">{f.name}</span>
                          </div>
                          <span className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            P:{f.proteinPer100}g · C:{f.carbsPer100}g · G:{f.fatPer100}g
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-mono text-xs font-bold text-emerald-400 whitespace-nowrap">
                            {f.caloriesPer100} kcal
                          </span>
                          <span className="text-zinc-600 text-xs">›</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
