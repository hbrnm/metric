import { useState, useEffect, useRef } from 'react';
import { fetchFoodByBarcode } from '../services/foodApi';
import { logFoodByGrams } from '../db/operations';
import { FoodItem, MealType } from '../types/nutrition';

interface Props {
  date: string;
  mealType: MealType;
  onClose: () => void;
}

export function BarcodeScannerModal({ date, mealType, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isProcessingRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectorSupported] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window);
  const [loading, setLoading] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [food, setFood] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState('100');
  const [error, setError] = useState('');

  // 1. Initializare camera video
  useEffect(() => {
    if (!detectorSupported || food) return;
    let stream: MediaStream | null = null;
    let active = true;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (active) setCameraError('Accesul la cameră a fost refuzat sau camera nu este disponibilă.');
      });

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [detectorSupported, food]);

  const handleLookup = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setLoading(true);
    setNotFound(false);
    setError('');

    try {
      const result = await fetchFoodByBarcode(code);
      if (result) {
        setFood(result);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
      isProcessingRef.current = false;
    }
  };

  // 2. Bucla de detectie a codurilor de bare
  useEffect(() => {
    if (!detectorSupported || food || cameraError) return;

    // @ts-ignore
    const detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'] });
    let intervalId: number | undefined;

    intervalId = window.setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || isProcessingRef.current) return;
      try {
        const results = await detector.detect(videoRef.current);
        if (results && results.length > 0 && results[0].rawValue) {
          handleLookup(results[0].rawValue);
        }
      } catch {
        // cadru intermediar fără cod detectabil
      }
    }, 450);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [detectorSupported, food, cameraError]);

  const handleSave = async () => {
    if (!food) return;
    const parsedGrams = parseFloat(grams);
    if (!Number.isFinite(parsedGrams) || parsedGrams <= 0) {
      setError('Te rugăm să introduci un gramaj pozitiv valid.');
      return;
    }

    try {
      await logFoodByGrams({ date, mealType, food, grams: parsedGrams });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-md p-5 pb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base font-bold text-white">Scanare cod de bare</h2>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        {food ? (
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
              <h3 className="text-base font-bold text-white leading-tight">{food.name}</h3>
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-zinc-800/60 font-mono text-center text-xs">
                <div><span className="text-zinc-500 block">kcal/100g</span><span className="text-white font-bold">{food.caloriesPer100}</span></div>
                <div><span className="text-zinc-500 block">P</span><span className="text-sky-400 font-bold">{food.proteinPer100}g</span></div>
                <div><span className="text-zinc-500 block">C</span><span className="text-amber-400 font-bold">{food.carbsPer100}g</span></div>
                <div><span className="text-zinc-500 block">G</span><span className="text-indigo-400 font-bold">{food.fatPer100}g</span></div>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Cantitate consumată:</span>
              <div className="flex items-center gap-1.5 w-24">
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-right font-mono text-sm text-white"
                />
                <span className="text-xs text-zinc-500">g</span>
              </div>
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <button onClick={handleSave} className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm">
              Adaugă în jurnal
            </button>
            <button onClick={() => setFood(null)} className="w-full h-9 text-zinc-400 text-xs hover:text-white">
              Scanează alt produs
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {detectorSupported && !cameraError && (
              <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-zinc-800">
                <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                {loading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-semibold">
                    Căutare produs...
                  </div>
                )}
              </div>
            )}

            {!detectorSupported && (
              <p className="text-xs text-zinc-500 bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                Scanarea automată prin cameră nu este suportată nativ de acest browser (frecvent pe iOS/Safari). Introdu codul manual mai jos.
              </p>
            )}

            {cameraError && (
              <p className="text-xs text-amber-400 bg-zinc-950 border border-zinc-800 rounded-xl p-3">{cameraError}</p>
            )}

            {notFound && (
              <p className="text-xs text-rose-400">Produsul nu a fost găsit în Open Food Facts sau datele sunt incomplete.</p>
            )}

            <div className="pt-1">
              <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1.5">
                Sau introdu codul manual
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="ex: 5941014002345"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(manualBarcode); }}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
                <button
                  onClick={() => handleLookup(manualBarcode)}
                  disabled={!manualBarcode.trim() || loading}
                  className="px-4 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs"
                >
                  {loading ? '...' : 'Caută'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
