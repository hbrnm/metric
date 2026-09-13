import { useState } from 'react';
import { generateCsvExport } from '../db/operations';
import { shiftDate, getLocalDateString } from '../utils/date';

interface Props {
  onClose: () => void;
}

export function ExportDiaryModal({ onClose }: Props) {
  const today = getLocalDateString();
  const [range, setRange] = useState<'7' | '14' | '30'>('7');
  const [exporting, setExporting] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const startDate = shiftDate(today, -parseInt(range, 10) + 1);
  const endDate = today;

  const handleDownloadCsv = async () => {
    setExporting(true);
    try {
      const csv = await generateCsvExport(startDate, endDate);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `metric_jurnal_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const handleCopySummary = async () => {
    try {
      const csv = await generateCsvExport(startDate, endDate);
      await navigator.clipboard.writeText(csv);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    } catch {
      alert('Nu s-a putut copia în clipboard.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-base font-bold text-white">Export Jurnal Nutrițional</h2>
          </div>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
          Generează un raport complet cu toate mesele, caloriile și macronutrienții tăi pentru analiză în Excel sau trimitere către nutriționist.
        </p>

        {/* Selector Interval */}
        <div className="mb-4">
          <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1.5">Alege perioada:</label>
          <div className="flex gap-2">
            {(['7', '14', '30'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition ${
                  range === r ? 'bg-emerald-500 text-zinc-950 border-emerald-400 font-bold' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                {r === '7' ? 'Ultimele 7 zile' : r === '14' ? 'Ultimele 14 zile' : 'Ultimele 30 zile'}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-mono text-zinc-500 block mt-1.5 text-center">
            {startDate} → {endDate}
          </span>
        </div>

        {copiedNotice && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-2 rounded-xl mb-3 text-center">
            ✓ Copiat în clipboard!
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleDownloadCsv}
            disabled={exporting}
            className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2"
          >
            <span>📥</span>
            <span>{exporting ? 'Se generează...' : 'Descarcă Fișier CSV'}</span>
          </button>
          <button
            onClick={handleCopySummary}
            className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-xl text-xs transition"
          >
            📋 Copiază Datele ca Text
          </button>
        </div>
      </div>
    </div>
  );
}
