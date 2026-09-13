import { useState, useMemo } from 'react';
import { WeightEntry } from '../types/nutrition';
import { formatDisplayDate } from '../utils/date';

interface Props {
  data: WeightEntry[];
}

export function WeightChart({ data }: Props) {
  const [range, setRange] = useState<'14' | '30' | '90' | 'all'>('30');
  const [hoveredEntry, setHoveredEntry] = useState<WeightEntry | null>(null);

  // Filtrăm datele în funcție de intervalul selectat
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (range === 'all') return data;
    const days = parseInt(range, 10);
    return data.slice(-days);
  }, [data, range]);

  // Dimensiuni SVG
  const width = 420;
  const height = 210;
  const padding = { top: 25, right: 20, bottom: 30, left: 42 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculăm valorile min/max pentru scalare pe axa Y
  const { minWeight, maxWeight, points } = useMemo(() => {
    if (filteredData.length === 0) {
      return { minWeight: 60, maxWeight: 80, points: [] };
    }

    let min = Infinity;
    let max = -Infinity;

    filteredData.forEach((d) => {
      const w = d.weightKg;
      const t = d.trendWeight;
      if (w < min) min = w;
      if (w > max) max = w;
      if (t < min) min = t;
      if (t > max) max = t;
    });

    // Adăugăm o margine de 0.8 kg sus/jos pentru lizibilitate
    const roundedMin = Math.floor((min - 0.8) * 2) / 2;
    const roundedMax = Math.ceil((max + 0.8) * 2) / 2;
    const span = Math.max(1, roundedMax - roundedMin);

    const pts = filteredData.map((d, idx) => {
      const x =
        filteredData.length === 1
          ? padding.left + chartWidth / 2
          : padding.left + (idx / (filteredData.length - 1)) * chartWidth;

      const rawY = padding.top + (1 - (d.weightKg - roundedMin) / span) * chartHeight;
      const trendY = padding.top + (1 - (d.trendWeight - roundedMin) / span) * chartHeight;

      return {
        entry: d,
        x,
        rawY,
        trendY,
      };
    });

    return { minWeight: roundedMin, maxWeight: roundedMax, points: pts };
  }, [filteredData, chartWidth, chartHeight, padding.left, padding.top]);

  if (filteredData.length === 0) {
    return (
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-center text-xs text-zinc-500">
        Nu există date de greutate suficiente pentru grafic.
      </div>
    );
  }

  // Generare path SVG pentru linia netedă de trend EMA
  const trendPath = points.reduce((path, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.trendY}` : `${path} L ${pt.x} ${pt.trendY}`;
  }, '');

  // Linii de grilă pe axa Y (3 praguri: minim, mijloc, maxim)
  const midWeight = Math.round(((minWeight + maxWeight) / 2) * 10) / 10;
  const gridY = [
    { val: maxWeight, y: padding.top },
    { val: midWeight, y: padding.top + chartHeight / 2 },
    { val: minWeight, y: padding.top + chartHeight },
  ];

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
      {/* Header grafic & selector interval */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span className="text-zinc-300 font-medium text-[11px]">Trend EMA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 inline-block" />
            <span className="text-zinc-500 text-[11px]">Greutate brută</span>
          </div>
        </div>

        {/* Butoane selector interval */}
        <div className="flex gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
          {(['14', '30', '90', 'all'] as const).map((r) => (
            <button
              key={r}
              onClick={() => { setRange(r); setHoveredEntry(null); }}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition ${
                range === r
                  ? 'bg-zinc-100 text-zinc-950 font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {r === 'all' ? 'Tot' : `${r}z`}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Canvas Nativ */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoveredEntry(null)}
        >
          {/* Linii de fundal orizontale (Grid) */}
          {gridY.map((g, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={g.y}
                x2={width - padding.right}
                y2={g.y}
                stroke="#27272a"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 6}
                y={g.y + 3}
                fill="#71717a"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="end"
              >
                {g.val}
              </text>
            </g>
          ))}

          {/* Linia de Trend EMA */}
          {trendPath && (
            <path
              d={trendPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Puncte pentru greutatea brută zilnică */}
          {points.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.rawY}
              r={hoveredEntry?.date === pt.entry.date ? 4.5 : 2.5}
              fill={hoveredEntry?.date === pt.entry.date ? '#38bdf8' : '#71717a'}
              stroke="#09090b"
              strokeWidth="1"
            />
          ))}

          {/* Indicator vertical și puncte active la hover/touch */}
          {hoveredEntry && (() => {
            const activePt = points.find((p) => p.entry.date === hoveredEntry.date);
            if (!activePt) return null;
            return (
              <g>
                <line
                  x1={activePt.x}
                  y1={padding.top}
                  x2={activePt.x}
                  y2={height - padding.bottom}
                  stroke="#52525b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <circle cx={activePt.x} cy={activePt.trendY} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
              </g>
            );
          })()}

          {/* Arii invizibile pentru hover / touch facil */}
          {points.map((pt, idx) => (
            <rect
              key={idx}
              x={pt.x - chartWidth / (points.length * 2 || 1)}
              y={padding.top}
              width={chartWidth / (points.length || 1)}
              height={chartHeight}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredEntry(pt.entry)}
              onTouchStart={() => setHoveredEntry(pt.entry)}
            />
          ))}

          {/* Etichete pe axa X: prima și ultima dată */}
          {points.length > 0 && (
            <g fill="#71717a" fontSize="10" fontFamily="monospace">
              <text x={points.length === 1 ? width / 2 : padding.left} y={height - 10} textAnchor={points.length === 1 ? 'middle' : 'start'}>
                {points[0].entry.date.slice(5)}
              </text>
              {points.length > 1 && (
                <text x={width - padding.right} y={height - 10} textAnchor="end">
                  {points[points.length - 1].entry.date.slice(5)}
                </text>
              )}
            </g>
          )}
        </svg>

        {/* Tooltip dinamic */}
        {hoveredEntry && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-white px-3 py-1.5 rounded-xl shadow-xl text-xs font-mono flex items-center gap-3 pointer-events-none animate-in fade-in">
            <span className="text-zinc-400 font-semibold">{formatDisplayDate(hoveredEntry.date)}:</span>
            <span>
              <strong className="text-white">{hoveredEntry.weightKg} kg</strong>
              <span className="text-emerald-400 ml-1.5">(trend {hoveredEntry.trendWeight} kg)</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
