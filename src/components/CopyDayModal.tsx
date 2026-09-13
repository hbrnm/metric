import { useState, useEffect } from 'react';
import { db } from '../db';
import { copyFullDayToDate } from '../db/operations';
import { LogEntry } from '../types/nutrition';
import { shiftDate, formatDisplayDate } from '../utils/date';

interface Props {
  targetDate: string;
  onClose: () => void;
  onCopied: () => void;
}

export function CopyDayModal({ targetDate, onClose, onCopied }: Props) {
  const yesterday = shiftDate(targetDate, -1);
  const twoDaysAgo = shiftDate(targetDate, -2);
  const sevenDaysAgo = shiftDate(targetDate, -7);

  const [sourceDate, setSourceDate] = useState(yesterday);
  const [sourceLogs, setSourceLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    db.logs
      .where('date')
      .equals(sourceDate)
      .toArray()
      .then((items) => {
        if (active) {
          setSourceLogs(items);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [sourceDate]);

  const totalCalories = sourceLogs.reduce((s, i) => s + i.calories, 0);

  const handleCopy = async () => {
    if (sourceLogs.length === 0) return;
    setCopying(true);
    try {
      await copyFullDayToDate(sourceDate, targetDate);
      onCopied();
      onClose();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h2 className="text-base font-bold text-white">Copiază Jurnal dintr-o Zi</h2>
          </div>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
          Copiază toate mesele dintr-o zi anterioară direct în data curentă ({formatDisplayDate(targetDate)}).
        </p>

        {/* Butoane rapide de selecție dată */}
        <div className="flex gap-1.5 mb-3">
          <button
            onClick={() => setSourceDate(yesterday)}
            className={`flex-1 py-1 text-xs font-semibold rounded-lg border transition ${
              sourceDate === yesterday ? 'bg-zinc-100 text-zinc-950 border-white' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            Ieri
          </button>
          <button
            onClick={() => setSourceDate(twoDaysAgo)}
            className={`flex-1 py-1 text-xs font-semibold rounded-lg border transition ${
              sourceDate === twoDaysAgo ? 'bg-zinc-100 text-zinc-950 border-white' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            Acum 2 zile
          </button>
          <button
            onClick={() => setSourceDate(sevenDaysAgo)}
            className={`flex-1 py-1 text-xs font-semibold rounded-lg border transition ${
              sourceDate === sevenDaysAgo ? 'bg-zinc-100 text-zinc-950 border-white' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            Săpt. trecută
          </button>
        </div>

        <div className="mb-4">
          <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Sau alege data din calendar:</label>
          <input
            type="date"
            value={sourceDate}
            onChange={(e) => setSourceDate(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 font-mono"
          />
        </div>

        {/* Previzualizare alimente găsite */}
        <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-2xl mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-zinc-300">
              Găsite pe {formatDisplayDate(sourceDate)}:
            </span>
            <span className="font-mono text-xs font-bold text-emerald-400">
              {totalCalories} kcal
            </span>
          </div>

          {loading ? (
            <p className="text-xs text-zinc-500 py-3 text-center">Se caută mesele...</p>
          ) : sourceLogs.length === 0 ? (
            <p className="text-xs text-zinc-600 py-3 text-center italic">
              Nu există niciun aliment înregistrat în acea zi.
            </p>
          ) : (
            <ul className="space-y-1 max-h-36 overflow-y-auto text-xs text-zinc-400 font-mono pr-1">
              {sourceLogs.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span className="truncate max-w-[200px] text-zinc-300">{item.name}</span>
                  <span>{item.calories} kcal</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={handleCopy}
          disabled={sourceLogs.length === 0 || copying || loading}
          className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-sm transition"
        >
          {copying ? 'Se copiază...' : `Copiază ${sourceLogs.length} alimente în ${formatDisplayDate(targetDate)}`}
        </button>
      </div>
    </div>
  );
}
