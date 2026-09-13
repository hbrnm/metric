import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getLocalDateString, shiftDate, formatDisplayDate } from '../utils/date';
import { useActiveTarget } from '../hooks/useActiveTarget';

interface Props {
  onClose: () => void;
}

export function WeeklySummaryModal({ onClose }: Props) {
  const [rangeDays, setRangeDays] = useState<'7' | '14' | '30'>('7');
  const [hoveredDay, setHoveredDay] = useState<{
    date: string;
    dayLabel: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    targetCals: number;
  } | null>(null);

  const today = getLocalDateString();
  const numDays = parseInt(rangeDays, 10);
  const startDate = shiftDate(today, -numDays + 1);
  const endDate = today;

  const currentTarget = useActiveTarget(today);
  const fallbackTargetCalories = currentTarget?.calories || 2100;
  const fallbackTargetProtein = currentTarget?.protein || 160;

  // Interogăm reactiv jurnalele și apa pentru intervalul selectat
  const periodData = useLiveQuery(async () => {
    const logs = await db.logs
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();

    const waterLogs = await db.waterLogs
      .where('date')
      .between(startDate, endDate, true, true)
      .toArray();

    return { logs, waterLogs };
  }, [startDate, endDate]);

  const logs = periodData?.logs ?? [];
  const waterLogs = periodData?.waterLogs ?? [];

  // Agregare pe zile calendaristice
  const dayList = useMemo(() => {
    const map = new Map<
      string,
      {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        waterMl: number;
      }
    >();

    // Inițializare toate zilele din interval
    for (let i = 0; i < numDays; i++) {
      const d = shiftDate(startDate, i);
      map.set(d, { calories: 0, protein: 0, carbs: 0, fat: 0, waterMl: 0 });
    }

    for (const log of logs) {
      if (log.status !== 'consumed') continue;
      const current = map.get(log.date);
      if (current) {
        current.calories += log.calories || 0;
        current.protein += log.protein || 0;
        current.carbs += log.carbs || 0;
        current.fat += log.fat || 0;
      }
    }

    for (const w of waterLogs) {
      const current = map.get(w.date);
      if (current) {
        current.waterMl = w.milliliters || 0;
      }
    }

    return Array.from(map.entries()).map(([date, values]) => {
      const [y, m, d] = date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayShort = dateObj.toLocaleDateString('ro-RO', { weekday: 'short' });
      return {
        date,
        dayLabel: dayShort.slice(0, 3),
        dayNum: String(d),
        calories: Math.round(values.calories),
        protein: Math.round(values.protein * 10) / 10,
        carbs: Math.round(values.carbs * 10) / 10,
        fat: Math.round(values.fat * 10) / 10,
        waterMl: values.waterMl,
        isLogged: values.calories > 0,
      };
    });
  }, [numDays, startDate, logs, waterLogs]);

  // Statistici globale perioadă
  const stats = useMemo(() => {
    const loggedDays = dayList.filter((d) => d.isLogged);
    const count = loggedDays.length || 1;

    const totalCals = loggedDays.reduce((acc, d) => acc + d.calories, 0);
    const totalProt = loggedDays.reduce((acc, d) => acc + d.protein, 0);
    const totalCarbs = loggedDays.reduce((acc, d) => acc + d.carbs, 0);
    const totalFat = loggedDays.reduce((acc, d) => acc + d.fat, 0);

    const avgCalories = Math.round(totalCals / count);
    const avgProtein = Math.round((totalProt / count) * 10) / 10;
    const avgCarbs = Math.round((totalCarbs / count) * 10) / 10;
    const avgFat = Math.round((totalFat / count) * 10) / 10;

    // Rata de atingere proteine (zile cu >= 90% din target)
    const proteinTargetReachedDays = loggedDays.filter(
      (d) => d.protein >= fallbackTargetProtein * 0.9
    ).length;
    const proteinComplianceRate =
      loggedDays.length > 0
        ? Math.round((proteinTargetReachedDays / loggedDays.length) * 100)
        : 0;

    // Aport caloric vs Target
    const calorieDelta = avgCalories - fallbackTargetCalories;

    // Total apă medie
    const waterDaysWithData = dayList.filter((d) => d.waterMl > 0);
    const avgWaterMl =
      waterDaysWithData.length > 0
        ? Math.round(
            waterDaysWithData.reduce((acc, d) => acc + d.waterMl, 0) /
              waterDaysWithData.length
          )
        : 0;

    return {
      loggedDaysCount: loggedDays.length,
      avgCalories,
      avgProtein,
      avgCarbs,
      avgFat,
      calorieDelta,
      proteinTargetReachedDays,
      proteinComplianceRate,
      avgWaterMl,
    };
  }, [dayList, fallbackTargetCalories, fallbackTargetProtein]);

  // Dimensiuni SVG Bar Chart
  const chartWidth = 420;
  const chartHeight = 160;
  const padding = { top: 25, right: 15, bottom: 25, left: 38 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const maxCal = Math.max(
    fallbackTargetCalories * 1.25,
    ...dayList.map((d) => d.calories),
    1800
  );

  const barWidth = Math.max(6, Math.min(28, (innerWidth / dayList.length) * 0.65));
  const barGap = innerWidth / dayList.length;

  const targetY = padding.top + innerHeight - (fallbackTargetCalories / maxCal) * innerHeight;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-lg p-5 pb-8 max-h-[90vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Rezumat & Analiză Nutrițională
              </h2>
              <p className="text-[11px] text-zinc-400">
                Evoluție calorică, aderență macronutrienți și hidratare
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Butoane selector interval */}
            <div className="flex gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              {(['7', '14', '30'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRangeDays(r)}
                  className={`px-2 py-0.5 text-xs font-semibold rounded-md transition ${
                    rangeDays === r
                      ? 'bg-zinc-100 text-zinc-950 font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {r}z
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              aria-label="Închide"
              className="text-zinc-400 hover:text-white text-2xl leading-none px-1"
            >
              ×
            </button>
          </div>
        </div>

        {/* Carduri KPI Principale */}
        <div className="grid grid-cols-3 gap-2">
          {/* Calorie medie */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
              Medie Calorii
            </span>
            <span className="text-base font-bold font-mono text-emerald-400 block">
              {stats.avgCalories}
            </span>
            <span
              className={`text-[10px] font-mono font-medium ${
                stats.calorieDelta <= 0 ? 'text-sky-400' : 'text-amber-400'
              }`}
            >
              {stats.calorieDelta > 0 ? '+' : ''}
              {stats.calorieDelta} vs țintă
            </span>
          </div>

          {/* Aderență proteine */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
              Proteine Atinge
            </span>
            <span className="text-base font-bold font-mono text-sky-400 block">
              {stats.proteinComplianceRate}%
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {stats.proteinTargetReachedDays}/{stats.loggedDaysCount} zile
            </span>
          </div>

          {/* Medie apă / zile logate */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
              {stats.avgWaterMl > 0 ? 'Medie Hidratare' : 'Zile Logate'}
            </span>
            <span className="text-base font-bold font-mono text-indigo-400 block">
              {stats.avgWaterMl > 0 ? `${(stats.avgWaterMl / 1000).toFixed(1)} L` : `${stats.loggedDaysCount} zile`}
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {stats.avgWaterMl > 0 ? 'apă/zi' : `din ${numDays} posibile`}
            </span>
          </div>
        </div>

        {/* Grafic Bară Nativ SVG */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-zinc-300">
                Calorii Zilnice vs. Țintă ({fallbackTargetCalories} kcal)
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />
                <span className="text-zinc-400">În țintă</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" />
                <span className="text-zinc-400">Peste</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-sky-400 inline-block" />
                <span className="text-zinc-400">Sub</span>
              </div>
            </div>
          </div>

          <div className="relative select-none">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible"
              onMouseLeave={() => setHoveredDay(null)}
            >
              {/* Linii de fundal Y (0, jumătate, maxim) */}
              {[0, Math.round(maxCal / 2), Math.round(maxCal)].map((val, idx) => {
                const y = padding.top + innerHeight - (val / maxCal) * innerHeight;
                return (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={chartWidth - padding.right}
                      y2={y}
                      stroke="#27272a"
                      strokeDasharray="2 2"
                    />
                    <text
                      x={padding.left - 4}
                      y={y + 3}
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Linie punctată Target Caloric */}
              <line
                x1={padding.left}
                y1={targetY}
                x2={chartWidth - padding.right}
                y2={targetY}
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />

              {/* Bare zilnice */}
              {dayList.map((d, idx) => {
                const x = padding.left + idx * barGap + (barGap - barWidth) / 2;
                const h = (d.calories / maxCal) * innerHeight;
                const y = padding.top + innerHeight - h;

                // Culoare bară
                let barColor = '#27272a'; // dacă e nelogat
                if (d.calories > 0) {
                  const ratio = d.calories / fallbackTargetCalories;
                  if (ratio >= 0.9 && ratio <= 1.1) {
                    barColor = '#10b981'; // verde în țintă
                  } else if (ratio < 0.9) {
                    barColor = '#38bdf8'; // albastru sub țintă
                  } else {
                    barColor = '#f59e0b'; // galben/amber peste țintă
                  }
                }

                const isHovered = hoveredDay?.date === d.date;

                return (
                  <g key={d.date}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(2, h)}
                      rx={3}
                      fill={barColor}
                      opacity={isHovered ? 1 : 0.85}
                      stroke={isHovered ? '#ffffff' : 'none'}
                      strokeWidth={1}
                    />

                    {/* Suprafață interactivă invizibilă pentru hover/touch facil */}
                    <rect
                      x={padding.left + idx * barGap}
                      y={padding.top}
                      width={barGap}
                      height={innerHeight + padding.bottom}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() =>
                        setHoveredDay({
                          date: d.date,
                          dayLabel: d.dayLabel,
                          calories: d.calories,
                          protein: d.protein,
                          carbs: d.carbs,
                          fat: d.fat,
                          targetCals: fallbackTargetCalories,
                        })
                      }
                      onTouchStart={() =>
                        setHoveredDay({
                          date: d.date,
                          dayLabel: d.dayLabel,
                          calories: d.calories,
                          protein: d.protein,
                          carbs: d.carbs,
                          fat: d.fat,
                          targetCals: fallbackTargetCalories,
                        })
                      }
                    />

                    {/* Etichetă zi X */}
                    <text
                      x={x + barWidth / 2}
                      y={chartHeight - 8}
                      fill={isHovered ? '#ffffff' : '#71717a'}
                      fontSize={numDays > 14 ? '8' : '9'}
                      fontFamily="sans-serif"
                      fontWeight={isHovered ? 'bold' : 'normal'}
                      textAnchor="middle"
                    >
                      {numDays <= 14 ? d.dayLabel : d.dayNum}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Tooltip Dinamic Bară */}
            {hoveredDay && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 text-white px-3 py-1.5 rounded-xl shadow-2xl text-xs font-mono flex items-center gap-3 pointer-events-none z-10 animate-in fade-in">
                <span className="text-zinc-400 font-bold">
                  {formatDisplayDate(hoveredDay.date)}:
                </span>
                <span className="font-bold text-emerald-400">{hoveredDay.calories} kcal</span>
                <span className="text-sky-400 text-[11px]">{hoveredDay.protein}g P</span>
                <span className="text-zinc-500 text-[10px]">
                  ({hoveredDay.calories - hoveredDay.targetCals > 0 ? '+' : ''}
                  {hoveredDay.calories - hoveredDay.targetCals} kcal)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Distribuție medie macronutrienți */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-2.5">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
            Media Zilnică a Macronutrienților
          </span>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2">
              <span className="text-zinc-400 text-[10px] block">Proteine</span>
              <span className="font-mono font-bold text-sky-400 text-sm">{stats.avgProtein} g</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {Math.round(stats.avgProtein * 4)} kcal
              </span>
            </div>
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2">
              <span className="text-zinc-400 text-[10px] block">Carbohidrați</span>
              <span className="font-mono font-bold text-amber-400 text-sm">{stats.avgCarbs} g</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {Math.round(stats.avgCarbs * 4)} kcal
              </span>
            </div>
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2">
              <span className="text-zinc-400 text-[10px] block">Grăsimi</span>
              <span className="font-mono font-bold text-indigo-400 text-sm">{stats.avgFat} g</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {Math.round(stats.avgFat * 9)} kcal
              </span>
            </div>
          </div>
        </div>

        {/* Detaliere zi cu zi */}
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider block">
            Jurnal Zilnic ({dayList.length} zile)
          </span>

          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {[...dayList].reverse().map((d) => {
              const delta = d.calories - fallbackTargetCalories;
              const protReached = d.protein >= fallbackTargetProtein * 0.9;
              return (
                <div
                  key={d.date}
                  className="flex justify-between items-center bg-zinc-950/80 border border-zinc-800/70 rounded-xl px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-300 font-medium">
                      {formatDisplayDate(d.date)}
                    </span>
                    {d.isLogged ? (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          protReached
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                        title={
                          protReached
                            ? 'Target de proteine atins'
                            : 'Sub targetul de proteine'
                        }
                      >
                        {protReached ? '✓ P atins' : '✗ P redus'}
                      </span>
                    ) : (
                      <span className="text-[9px] bg-zinc-800/60 text-zinc-500 px-1.5 py-0.5 rounded">
                        nelogat
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-white font-bold">{d.calories} kcal</span>
                    <span className="text-sky-400 text-[11px]">{d.protein}g P</span>
                    <span
                      className={`text-[10px] ${
                        delta <= 0 ? 'text-sky-400' : 'text-amber-400'
                      }`}
                    >
                      {delta > 0 ? '+' : ''}
                      {delta}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
