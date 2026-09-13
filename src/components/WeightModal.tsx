import React, { useState, useEffect, useMemo } from 'react';
import { logWeightEntry, deleteWeightEntry, generateWeightCsvExport } from '../db/operations';
import { useWeightData } from '../hooks/useWeightData';
import { useActiveTarget } from '../hooks/useActiveTarget';
import { formatDisplayDate, getLocalDateString } from '../utils/date';
import { detectWaterSpike, calculateWeightProjection } from '../algorithms/metabolic';
import { WeightChart } from './WeightChart';
import { WeightMeasurementContext } from '../types/nutrition';

interface Props {
  date: string;
  onClose: () => void;
}

const contextLabels: Record<WeightMeasurementContext, string> = {
  fasted_morning: 'Dimineața (nemâncat)',
  post_workout: 'Post-antrenament',
  evening: 'Seara',
};

export function WeightModal({ date, onClose }: Props) {
  const { history, analysis } = useWeightData();
  const target = useActiveTarget(date);

  const todayEntry = useMemo(() => history.find((w) => w.date === date), [history, date]);

  // Intrări formular
  const [weightInput, setWeightInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');
  const [waistInput, setWaistInput] = useState('');
  const [hipsInput, setHipsInput] = useState('');
  const [contextInput, setContextInput] = useState<WeightMeasurementContext>('fasted_morning');
  const [notesInput, setNotesInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Widget proiecție obiectiv
  const [goalWeightInput, setGoalWeightInput] = useState('');
  const [calorieIntakeInput, setCalorieIntakeInput] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [exporting, setExporting] = useState(false);

  // Sincronizare stare la selectarea sau modificarea intrării
  useEffect(() => {
    if (todayEntry) {
      setWeightInput(String(todayEntry.weightKg));
      setBodyFatInput(todayEntry.bodyFatPercent ? String(todayEntry.bodyFatPercent) : '');
      setWaistInput(todayEntry.waistCm ? String(todayEntry.waistCm) : '');
      setHipsInput(todayEntry.hipsCm ? String(todayEntry.hipsCm) : '');
      setContextInput(todayEntry.context || 'fasted_morning');
      setNotesInput(todayEntry.notes || '');
      if (todayEntry.bodyFatPercent || todayEntry.waistCm || todayEntry.hipsCm || todayEntry.notes) {
        setShowAdvanced(true);
      }
    } else {
      setWeightInput('');
      setBodyFatInput('');
      setWaistInput('');
      setHipsInput('');
      setContextInput('fasted_morning');
      setNotesInput('');
    }
  }, [todayEntry]);

  // Inițializare proiecție
  useEffect(() => {
    if (!goalWeightInput && history.length > 0) {
      const latestTrend = history[history.length - 1].trendWeight;
      setGoalWeightInput(String(Math.round((latestTrend - 5) * 10) / 10));
    }
  }, [history, goalWeightInput]);

  useEffect(() => {
    if (target?.calories && !calorieIntakeInput) {
      setCalorieIntakeInput(String(target.calories));
    }
  }, [target, calorieIntakeInput]);

  // Detectare Spike de Apă / Retenție pentru ziua curentă
  const waterSpikeInfo = useMemo(() => {
    if (!todayEntry) return null;
    const prevEntry = [...history].filter((w) => w.date < date).slice(-1)[0];
    return detectWaterSpike(todayEntry.weightKg, prevEntry?.weightKg, todayEntry.trendWeight);
  }, [todayEntry, history, date]);

  // Calcul proiecție obiectiv
  const projection = useMemo(() => {
    const latestTrend = todayEntry?.trendWeight ?? (history.length > 0 ? history[history.length - 1].trendWeight : undefined);
    const goalKg = parseFloat(goalWeightInput);
    const intake = parseFloat(calorieIntakeInput || String(target?.calories || 2000));
    const effectiveTdee = analysis.tdee || 2200;

    if (!latestTrend || !Number.isFinite(goalKg) || !Number.isFinite(intake)) {
      return null;
    }

    return calculateWeightProjection(latestTrend, goalKg, effectiveTdee, intake);
  }, [todayEntry, history, goalWeightInput, calorieIntakeInput, target, analysis.tdee]);

  const handleSave = async () => {
    setError('');
    setSuccessMsg('');
    const val = parseFloat(weightInput);
    if (!Number.isFinite(val) || val <= 20 || val >= 300) {
      setError('Introdu o greutate validă între 20 și 300 kg.');
      return;
    }

    const bodyFat = bodyFatInput ? parseFloat(bodyFatInput) : undefined;
    if (bodyFat !== undefined && (!Number.isFinite(bodyFat) || bodyFat < 3 || bodyFat > 60)) {
      setError('Procentul de grăsime trebuie să fie între 3% și 60%.');
      return;
    }

    const waist = waistInput ? parseFloat(waistInput) : undefined;
    if (waist !== undefined && (!Number.isFinite(waist) || waist < 30 || waist > 200)) {
      setError('Circumferința taliei trebuie să fie între 30 și 200 cm.');
      return;
    }

    const hips = hipsInput ? parseFloat(hipsInput) : undefined;
    if (hips !== undefined && (!Number.isFinite(hips) || hips < 30 || hips > 250)) {
      setError('Circumferința șoldurilor trebuie să fie între 30 și 250 cm.');
      return;
    }

    try {
      await logWeightEntry(date, val, {
        bodyFatPercent: bodyFat,
        waistCm: waist,
        hipsCm: hips,
        context: contextInput,
        notes: notesInput,
      });
      setSuccessMsg('Măsurătoarea a fost salvată cu succes.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (targetDate: string) => {
    if (confirm(`Ștergi înregistrarea de greutate pentru ${formatDisplayDate(targetDate)}?`)) {
      try {
        await deleteWeightEntry(targetDate);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  const handleDownloadCsv = async () => {
    setExporting(true);
    try {
      const csv = await generateWeightCsvExport();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metric_istoric_greutate_${getLocalDateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-lg p-5 pb-8 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header Modal */}
        <div className="flex justify-between items-center pb-1 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚖️</span>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Greutate & TDEE Metabolic</h2>
              <p className="text-[11px] text-zinc-400">Trend adaptiv exponențial & analiză compoziție</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              disabled={exporting || history.length === 0}
              className="text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-lg border border-zinc-700 disabled:opacity-40 transition flex items-center gap-1"
              title="Exportă datele de greutate în format CSV"
            >
              <span>📥</span>
              <span>{exporting ? 'Export...' : 'CSV'}</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Închide"
              className="text-zinc-400 hover:text-white text-2xl leading-none px-1"
            >
              ×
            </button>
          </div>
        </div>

        {/* Grafic SVG Nativ Interactiv */}
        <WeightChart data={history} />

        {/* Notificare Spike / Retenție de Apă */}
        {waterSpikeInfo?.isSpike && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-2xl p-3.5 flex items-start gap-3">
            <span className="text-lg leading-none mt-0.5">💧</span>
            <div className="text-xs text-amber-200/90 leading-relaxed">
              <p className="font-bold text-amber-300 mb-0.5">Fluctuație temporară de apă detectată</p>
              <p>{waterSpikeInfo.message}</p>
            </div>
          </div>
        )}

        {/* Formular Înregistrare Greutate & Detalii */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-baseline">
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
              {formatDisplayDate(date)}
            </label>
            {todayEntry && (
              <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                Trend EMA: {todayEntry.trendWeight} kg
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder={todayEntry ? String(todayEntry.weightKg) : 'ex. 78.4'}
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 font-mono text-xl font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm pointer-events-none">
                kg
              </span>
            </div>

            <button
              onClick={handleSave}
              disabled={!weightInput}
              className="h-11 px-5 bg-emerald-500 disabled:opacity-30 hover:bg-emerald-400 active:scale-95 text-zinc-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/10"
            >
              {todayEntry ? 'Actualizează' : 'Salvează'}
            </button>
          </div>

          {/* Comutator Câmpuri Avansate */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[11px] font-medium text-zinc-400 hover:text-emerald-400 flex items-center gap-1.5 transition mt-1"
            >
              <span>{showAdvanced ? '▲ Ascunde opțiuni avansate' : '▼ Măsurători & detalii avansate (talie, grăsime, context)'}</span>
            </button>

            {showAdvanced && (
              <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-3 animate-in fade-in duration-200">
                {/* Context Măsurătoare */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1.5">
                    Context Măsurătoare
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(contextLabels) as WeightMeasurementContext[]).map((ctx) => (
                      <button
                        key={ctx}
                        type="button"
                        onClick={() => setContextInput(ctx)}
                        className={`text-[10px] py-1.5 px-2 rounded-lg font-medium border text-center transition ${
                          contextInput === ctx
                            ? 'bg-emerald-500/10 border-emerald-500/60 text-emerald-300 font-bold'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {contextLabels[ctx]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grăsime corporală, Talie, Șolduri */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                      Grăsime %
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      placeholder="18.5"
                      value={bodyFatInput}
                      onChange={(e) => setBodyFatInput(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                      Talie (cm)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      placeholder="84"
                      value={waistInput}
                      onChange={(e) => setWaistInput(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                      Șolduri (cm)
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      placeholder="98"
                      value={hipsInput}
                      onChange={(e) => setHipsInput(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                </div>

                {/* Notițe */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                    Notițe / Factori fiziologici
                  </label>
                  <input
                    type="text"
                    placeholder="ex. somn 6h, masă sărată aseară, antrenament picioare"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
          {successMsg && <p className="text-xs text-emerald-400 font-medium">{successMsg}</p>}
        </div>

        {/* Card Analiză Metabolică Adaptivă (TDEE) */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
              Analiză Metabolică Adaptivă
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                analysis.isReliable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {analysis.isReliable ? 'Fiabil (21 zile)' : 'Date insuficiente'}
            </span>
          </div>

          {analysis.isReliable ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                <span className="text-zinc-400">Consum real estimat (TDEE):</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">{analysis.tdee} kcal</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                <span className="text-zinc-400">Aport caloric mediu logat:</span>
                <span className="font-mono text-zinc-200">{analysis.averageIntake} kcal/zi</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400">Ritm trend săptămânal:</span>
                <span className="font-mono font-semibold text-zinc-200">
                  {(analysis.weeklyWeightDelta ?? 0) > 0 ? '+' : ''}
                  {analysis.weeklyWeightDelta} kg/săpt
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-400 leading-relaxed">{analysis.reason}</p>
          )}
        </div>

        {/* Proiecție Obiectiv Greutate */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
              Proiecție Obiectiv Greutate
            </span>
            <span className="text-[10px] text-zinc-500">Model energetic (7700 kcal/kg)</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Greutate țintă (kg)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                placeholder="75.0"
                value={goalWeightInput}
                onChange={(e) => setGoalWeightInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Aport caloric țintă (kcal/zi)</label>
              <input
                type="number"
                inputMode="numeric"
                step="50"
                placeholder="2000"
                value={calorieIntakeInput}
                onChange={(e) => setCalorieIntakeInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          {projection ? (
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Data estimată de atingere:</span>
                <span className="font-bold text-emerald-400 text-sm font-mono">{projection.estimatedDate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Timp estimat:</span>
                <span className="font-mono text-zinc-200">~{projection.estimatedWeeks} săptămâni</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Ritm prognozat:</span>
                <span className="font-mono text-zinc-200">
                  {projection.weeklyDeltaKg > 0 ? '+' : ''}{projection.weeklyDeltaKg} kg/săpt
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Bilanț energetic zilnic:</span>
                <span className={`font-mono font-medium ${projection.dailyCalorieDeficitOrSurplus < 0 ? 'text-sky-400' : 'text-amber-400'}`}>
                  {projection.dailyCalorieDeficitOrSurplus > 0 ? '+' : ''}
                  {projection.dailyCalorieDeficitOrSurplus} kcal/zi
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500 leading-relaxed italic">
              Introdu o greutate țintă diferită de trendul actual și un aport caloric adecvat (deficit pentru slăbire, surplus pentru masă).
            </p>
          )}
        </div>

        {/* Istoric Înregistrări & Ștergere */}
        {history.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
              Istoric măsurători ({history.length})
            </h3>
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {[...history].reverse().map((w) => (
                <li
                  key={w.date}
                  className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-2.5 text-xs space-y-1.5"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-300">{formatDisplayDate(w.date)}</span>
                      {w.context && (
                        <span className="text-[9px] bg-zinc-800/90 text-zinc-400 px-1.5 py-0.5 rounded font-medium">
                          {contextLabels[w.context] || w.context}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-white font-bold text-sm">{w.weightKg} kg</span>
                      <span className="font-mono text-emerald-400/90 text-[10px]">
                        trend {w.trendWeight} kg
                      </span>
                      <button
                        onClick={() => handleDelete(w.date)}
                        aria-label="Șterge"
                        className="text-zinc-600 hover:text-rose-400 text-base px-1 leading-none transition"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {/* Detalii compoziție dacă există */}
                  {(w.bodyFatPercent || w.waistCm || w.hipsCm || w.notes) && (
                    <div className="pt-1 border-t border-zinc-900 flex flex-wrap gap-2 text-[10px] text-zinc-400 font-mono">
                      {w.bodyFatPercent && (
                        <span className="bg-zinc-900 px-1.5 py-0.5 rounded">
                          Gras: <strong className="text-zinc-200">{w.bodyFatPercent}%</strong>
                        </span>
                      )}
                      {w.waistCm && (
                        <span className="bg-zinc-900 px-1.5 py-0.5 rounded">
                          Talie: <strong className="text-zinc-200">{w.waistCm} cm</strong>
                        </span>
                      )}
                      {w.hipsCm && (
                        <span className="bg-zinc-900 px-1.5 py-0.5 rounded">
                          Șolduri: <strong className="text-zinc-200">{w.hipsCm} cm</strong>
                        </span>
                      )}
                      {w.notes && (
                        <p className="w-full text-zinc-500 font-sans italic pt-0.5">
                          „{w.notes}”
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
