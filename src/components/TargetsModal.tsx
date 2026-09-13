import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { addTarget, deleteTarget } from '../db/operations';
import { WeeklyTarget } from '../types/nutrition';
import { getLocalDateString } from '../utils/date';
import { useWeightData } from '../hooks/useWeightData';
import {
  BiologicalSex,
  ActivityLevel,
  NutritionGoal,
  MacroPreset,
  BiometricsInput,
  calculateBMR,
  calculateTheoreticalTDEE,
  computeMacros,
  validateMacroBalance,
  autoBalanceCarbs,
} from '../algorithms/macroCalculator';

interface Props {
  currentTarget: WeeklyTarget;
  onClose: () => void;
}

export function TargetsModal({ currentTarget, onClose }: Props) {
  const today = getLocalDateString();
  const [tab, setTab] = useState<'calculator' | 'manual'>('calculator');

  // Manual & Active Form state
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [calories, setCalories] = useState(String(currentTarget.calories));
  const [protein, setProtein] = useState(String(currentTarget.protein));
  const [carbs, setCarbs] = useState(String(currentTarget.carbs));
  const [fat, setFat] = useState(String(currentTarget.fat));
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Weight & Metabolic context
  const { history: weightHistory, analysis } = useWeightData();
  const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weightKg : 75;

  // Smart Calculator Form state
  const [sex, setSex] = useState<BiologicalSex>('male');
  const [age, setAge] = useState('30');
  const [heightCm, setHeightCm] = useState('178');
  const [weightKg, setWeightKg] = useState(String(latestWeight));
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');
  const [useAdaptiveTdee, setUseAdaptiveTdee] = useState(false);
  const [goal, setGoal] = useState<NutritionGoal>('moderate_loss');
  const [macroPreset, setMacroPreset] = useState<MacroPreset>('high_protein');

  const history = useLiveQuery(
    () => db.targets.orderBy('effectiveFrom').reverse().toArray()
  ) ?? [];

  // Calculează valorile din Calculator
  const calculatedResult = useMemo(() => {
    const parsedAge = parseInt(age, 10) || 30;
    const parsedHeight = parseInt(heightCm, 10) || 175;
    const parsedWeight = parseFloat(weightKg) || 75;

    const bio: BiometricsInput = {
      sex,
      age: parsedAge,
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      activityLevel,
    };

    const bmr = calculateBMR(bio);
    const theoreticalTdee = calculateTheoreticalTDEE(bio);

    const baseTdee = (useAdaptiveTdee && analysis.isReliable && analysis.tdee)
      ? analysis.tdee
      : theoreticalTdee;

    const macros = computeMacros(baseTdee, goal, macroPreset, parsedWeight);

    return {
      bmr,
      theoreticalTdee,
      effectiveTdee: baseTdee,
      ...macros,
    };
  }, [sex, age, heightCm, weightKg, activityLevel, useAdaptiveTdee, analysis, goal, macroPreset]);

  // Validare consistență matematică pentru valorile curente din input
  const currentCaloriesNum = parseInt(calories, 10) || 0;
  const currentProteinNum = parseFloat(protein) || 0;
  const currentCarbsNum = parseFloat(carbs) || 0;
  const currentFatNum = parseFloat(fat) || 0;

  const balanceValidation = useMemo(() => {
    return validateMacroBalance(currentCaloriesNum, currentProteinNum, currentCarbsNum, currentFatNum);
  }, [currentCaloriesNum, currentProteinNum, currentCarbsNum, currentFatNum]);

  // Procente curente pentru bara vizuală
  const totalMacroCals = balanceValidation.sum || 1;
  const pctProtein = Math.min(100, Math.round(((currentProteinNum * 4) / totalMacroCals) * 100));
  const pctCarbs = Math.min(100, Math.round(((currentCarbsNum * 4) / totalMacroCals) * 100));
  const pctFat = Math.max(0, 100 - pctProtein - pctCarbs);

  const applyCalculatedToForm = () => {
    setCalories(String(calculatedResult.targetCalories));
    setProtein(String(calculatedResult.proteinGrams));
    setCarbs(String(calculatedResult.carbsGrams));
    setFat(String(calculatedResult.fatGrams));
    setSuccessMsg('Valorile calculate au fost transferate în formular.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleAutoBalance = () => {
    const balancedCarbs = autoBalanceCarbs(currentCaloriesNum, currentProteinNum, currentFatNum);
    setCarbs(String(balancedCarbs));
  };

  const handleSave = async (customCals?: number, customP?: number, customC?: number, customF?: number) => {
    setError('');
    const targetCals = customCals !== undefined ? customCals : parseInt(calories, 10);
    const targetP = customP !== undefined ? customP : parseFloat(protein) || 0;
    const targetC = customC !== undefined ? customC : parseFloat(carbs) || 0;
    const targetF = customF !== undefined ? customF : parseFloat(fat) || 0;

    if (!Number.isFinite(targetCals) || targetCals <= 0) {
      setError('Caloriile trebuie să fie un număr pozitiv valid.');
      return;
    }

    if (targetP < 0 || targetC < 0 || targetF < 0) {
      setError('Macronutrienții nu pot avea valori negative.');
      return;
    }

    try {
      await addTarget({
        effectiveFrom,
        calories: targetCals,
        protein: targetP,
        carbs: targetC,
        fat: targetF,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDeleteTarget = async (id?: string) => {
    if (!id) return;
    if (confirm('Sigur dorești să ștergi acest obiectiv din istoric?')) {
      await deleteTarget(id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎯</span>
            <div>
              <h2 className="text-base font-bold text-white">Obiective & Calculator Macro</h2>
              <p className="text-[10px] text-zinc-400">Setează-ți necesarul caloric și de macronutrienți</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        {/* Tab switch */}
        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 mb-4">
          <button
            onClick={() => setTab('calculator')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              tab === 'calculator'
                ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ⚡ Calculator Inteligent
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
              tab === 'manual'
                ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ✍️ Editare Manuală
          </button>
        </div>

        {tab === 'calculator' ? (
          /* CALCULATOR VIEW */
          <div className="space-y-4">
            {/* Biometrie */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-3.5 space-y-3">
              <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider block">
                1. Date Biometrice & Activitate
              </span>

              {/* Sex & Vârstă */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Sex Biologic</label>
                  <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                    <button
                      onClick={() => setSex('male')}
                      className={`flex-1 py-1 text-xs font-medium rounded-md ${
                        sex === 'male' ? 'bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-400'
                      }`}
                    >
                      Bărbat
                    </button>
                    <button
                      onClick={() => setSex('female')}
                      className={`flex-1 py-1 text-xs font-medium rounded-md ${
                        sex === 'female' ? 'bg-zinc-800 text-emerald-400 font-bold' : 'text-zinc-400'
                      }`}
                    >
                      Femeie
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Vârstă (ani)</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Greutate & Înălțime */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Greutate (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Înălțime (cm)</label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Nivel activitate */}
              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">Nivel de activitate zilnică</label>
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                >
                  <option value="sedentary">Sedentar (muncă la birou, puțin sport)</option>
                  <option value="light">Ușor activ (antrenament 1-3 zile/săpt)</option>
                  <option value="moderate">Moderat activ (antrenament 3-5 zile/săpt)</option>
                  <option value="very_active">Foarte activ (efort intens 6-7 zile/săpt)</option>
                </select>
              </div>

              {/* TDEE Adaptiv option dacă e disponibil */}
              {analysis.isReliable && analysis.tdee && (
                <div className="pt-2 border-t border-zinc-800/80">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useAdaptiveTdee}
                      onChange={(e) => setUseAdaptiveTdee(e.target.checked)}
                      className="rounded bg-zinc-900 border-zinc-700 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-[11px] text-zinc-300">
                      Folosește metabolismul real adaptiv:{' '}
                      <strong className="text-emerald-400 font-mono">{analysis.tdee} kcal/zi</strong>
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Obiectiv & Preset macro */}
            <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-3.5 space-y-3">
              <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider block">
                2. Obiectiv & Raport Macronutrienți
              </span>

              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">Obiectivul tău</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'moderate_loss', label: '📉 Slăbire (-20%)' },
                    { id: 'aggressive_loss', label: '⚡ Slăbire rapidă (-25%)' },
                    { id: 'maintenance', label: '⚖️ Menținere (0%)' },
                    { id: 'lean_bulk', label: '💪 Masă musculară (+10%)' },
                  ].map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setGoal(g.id as NutritionGoal)}
                      className={`text-left text-xs p-2 rounded-lg border transition ${
                        goal === g.id
                          ? 'bg-zinc-850 text-white border-emerald-500 font-medium'
                          : 'bg-zinc-900/60 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block mb-1">Preset Macronutrienți</label>
                <div className="space-y-1.5">
                  {[
                    { id: 'high_protein', title: '🥩 Bogat în Proteine', desc: '2.0g proteină/kg corp, ideal pentru definire și sațietate' },
                    { id: 'balanced', title: '🥗 Echilibrat', desc: '30% Proteine / 45% Carbohidrați / 25% Grăsimi' },
                    { id: 'low_carb', title: '🥑 Low Carb', desc: '35% Proteine / 20% Carbohidrați / 45% Grăsimi' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setMacroPreset(p.id as MacroPreset)}
                      className={`w-full text-left p-2 rounded-lg border transition ${
                        macroPreset === p.id
                          ? 'bg-zinc-850 text-white border-emerald-500'
                          : 'bg-zinc-900/60 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      <div className="text-xs font-semibold text-zinc-200">{p.title}</div>
                      <div className="text-[10px] text-zinc-500">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Rezultat Recomandat */}
            <div className="bg-gradient-to-br from-emerald-950/40 via-zinc-950 to-zinc-950 border border-emerald-500/30 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Recomandare Personalizată
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  BMR: {calculatedResult.bmr} · TDEE: {calculatedResult.effectiveTdee}
                </span>
              </div>

              <div className="text-center py-2">
                <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                  {calculatedResult.targetCalories}
                </span>
                <span className="text-xs text-emerald-400 ml-1.5 font-bold">kcal / zi</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-800 font-mono text-center">
                <div className="bg-zinc-900/80 p-2 rounded-xl border border-sky-500/20">
                  <span className="text-[10px] text-zinc-400 block">Proteine ({calculatedResult.proteinPercent}%)</span>
                  <span className="text-sm font-bold text-sky-400">{calculatedResult.proteinGrams}g</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded-xl border border-amber-500/20">
                  <span className="text-[10px] text-zinc-400 block">Carbo ({calculatedResult.carbsPercent}%)</span>
                  <span className="text-sm font-bold text-amber-400">{calculatedResult.carbsGrams}g</span>
                </div>
                <div className="bg-zinc-900/80 p-2 rounded-xl border border-indigo-500/20">
                  <span className="text-[10px] text-zinc-400 block">Grăsimi ({calculatedResult.fatPercent}%)</span>
                  <span className="text-sm font-bold text-indigo-400">{calculatedResult.fatGrams}g</span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    applyCalculatedToForm();
                    setTab('manual');
                  }}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-xl text-xs transition"
                >
                  Personalizează în formular ✍️
                </button>
                <button
                  onClick={() => handleSave(
                    calculatedResult.targetCalories,
                    calculatedResult.proteinGrams,
                    calculatedResult.carbsGrams,
                    calculatedResult.fatGrams
                  )}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs transition"
                >
                  Salvează direct 💾
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* MANUAL EDIT VIEW */
          <div className="space-y-4">
            {successMsg && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
                {successMsg}
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Valabil de la data</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Calorii*</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-emerald-400"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Proteine (g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-sky-400"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Carbohidrați (g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={carbs}
                  onChange={(e) => setCarbs(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-400"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Grăsimi (g)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={fat}
                  onChange={(e) => setFat(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono font-bold text-indigo-400"
                />
              </div>
            </div>

            {/* Visual Macro Ratio Bar */}
            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                <span>Distribuție: P:{pctProtein}% · C:{pctCarbs}% · G:{pctFat}%</span>
                <span>Din macro: {balanceValidation.sum} kcal</span>
              </div>
              <div className="h-2 w-full bg-zinc-800 rounded-full flex overflow-hidden">
                <div style={{ width: `${pctProtein}%` }} className="bg-sky-400" />
                <div style={{ width: `${pctCarbs}%` }} className="bg-amber-400" />
                <div style={{ width: `${pctFat}%` }} className="bg-indigo-400" />
              </div>

              {/* Consistency Check / Balance Helper */}
              {balanceValidation.isBalanced ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 pt-1">
                  <span>✓</span>
                  <span>Consistență matematică excelentă (4P + 4C + 9F ≈ {currentCaloriesNum} kcal)</span>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-amber-400">
                    ⚠️ Diferență de {balanceValidation.diff > 0 ? `+${balanceValidation.diff}` : balanceValidation.diff} kcal între macro și calorii
                  </span>
                  <button
                    onClick={handleAutoBalance}
                    className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold px-2 py-0.5 rounded border border-amber-500/30 transition"
                  >
                    Echilibrează din carbo
                  </button>
                </div>
              )}
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button
              onClick={() => handleSave()}
              className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm transition"
            >
              Salvează obiectiv
            </button>
          </div>
        )}

        {/* Istoric obiective */}
        {history.length > 0 && (
          <div className="mt-6 pt-5 border-t border-zinc-800/80">
            <h3 className="text-[10px] uppercase font-bold text-zinc-500 mb-2.5">Istoric obiective anterioare</h3>
            <ul className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {history.map((t) => (
                <li
                  key={t.id}
                  className="flex justify-between items-center text-xs bg-zinc-950/60 border border-zinc-800/60 rounded-lg px-3 py-2"
                >
                  <span className="text-zinc-400">din {t.effectiveFrom}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-300">
                      {t.calories} kcal · P{t.protein} C{t.carbs} G{t.fat}
                    </span>
                    {history.length > 1 && (
                      <button
                        onClick={() => handleDeleteTarget(t.id)}
                        className="text-zinc-600 hover:text-rose-400 text-xs px-1"
                        title="Șterge acest obiectiv"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
