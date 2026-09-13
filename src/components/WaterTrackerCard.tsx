import { logWater } from '../db/operations';
import { useWaterLog } from '../hooks/useWaterLog';

interface Props {
  date: string;
}

export function WaterTrackerCard({ date }: Props) {
  const { water, percentage } = useWaterLog(date);

  const handleAdd = async (ml: number) => {
    await logWater(date, ml);
  };

  const glassesCount = Math.round(water.milliliters / 250);

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">💧</span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Hidratare</h2>
        </div>
        <div className="text-right font-mono">
          <span className="text-sm font-bold text-sky-400">{water.milliliters}</span>
          <span className="text-xs text-zinc-500"> / {water.targetMl} ml</span>
        </div>
      </div>

      {/* Bară de progres hidratare */}
      <div className="w-full bg-zinc-950 rounded-full h-2.5 mb-3 overflow-hidden border border-zinc-800/80">
        <div
          className="bg-gradient-to-r from-sky-500 to-cyan-400 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between items-center text-xs">
        <span className="text-[11px] text-zinc-400 font-mono">
          {glassesCount} {glassesCount === 1 ? 'pahar' : 'pahare'} ({percentage}%)
        </span>
        <div className="flex gap-1.5">
          {water.milliliters > 0 && (
            <button
              onClick={() => handleAdd(-250)}
              className="px-2 py-1 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[11px] font-mono transition"
              title="Scade un pahar"
            >
              -250ml
            </button>
          )}
          <button
            onClick={() => handleAdd(250)}
            className="px-2.5 py-1 bg-sky-500/20 border border-sky-500/30 hover:bg-sky-500/30 text-sky-300 font-semibold rounded-lg text-[11px] font-mono transition"
          >
            +250ml
          </button>
          <button
            onClick={() => handleAdd(500)}
            className="px-2.5 py-1 bg-sky-500/20 border border-sky-500/30 hover:bg-sky-500/30 text-sky-300 font-semibold rounded-lg text-[11px] font-mono transition"
          >
            +500ml
          </button>
        </div>
      </div>
    </section>
  );
}
