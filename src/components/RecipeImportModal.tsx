import { useState } from 'react';
import { db } from '../db';
import { saveRecipe } from '../db/operations';
import { Recipe, RecipeIngredient, RecipeStep } from '../types/nutrition';
import { fetchRecipeFromUrl, parseRawTextIngredients, parseRecipeJson } from '../utils/recipeParser';

interface Props {
  onClose: () => void;
  onImported: (recipe: Recipe) => void;
}

export function RecipeImportModal({ onClose, onImported }: Props) {
  const [tab, setTab] = useState<'url' | 'paste' | 'json'>('url');

  // Stări pentru URL
  const [url, setUrl] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);

  // Stări pentru Smart Paste
  const [pastedText, setPastedText] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);

  // Stări pentru Previzualizare Rețetă Parsată
  const [previewName, setPreviewName] = useState('');
  const [previewIngredients, setPreviewIngredients] = useState<RecipeIngredient[]>([]);
  const [previewSteps, setPreviewSteps] = useState<RecipeStep[]>([]);
  const [previewServings, setPreviewServings] = useState(2);
  const [previewCookedWeight, setPreviewCookedWeight] = useState('');
  const [previewSourceUrl, setPreviewSourceUrl] = useState<string | undefined>(undefined);
  const [previewNotes, setPreviewNotes] = useState<string | undefined>(undefined);
  const [hasPreview, setHasPreview] = useState(false);

  // Stări pentru Fișier JSON
  const [jsonLoading, setJsonLoading] = useState(false);
  const [jsonStatus, setJsonStatus] = useState<string | null>(null);

  // Erori
  const [error, setError] = useState('');

  // --- Handlers ---
  const handleFetchUrl = async () => {
    if (!url.trim()) return;
    setUrlLoading(true);
    setError('');
    try {
      const parsed = await fetchRecipeFromUrl(url);
      setPreviewName(parsed.name);
      setPreviewIngredients(parsed.ingredients);
      setPreviewSteps(parsed.steps);
      setPreviewServings(parsed.servings);
      setPreviewCookedWeight(String(parsed.estimatedCookedWeight || ''));
      setPreviewSourceUrl(parsed.sourceUrl);
      setPreviewNotes(parsed.notes);
      setHasPreview(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUrlLoading(false);
    }
  };

  const handleParseText = async () => {
    if (!pastedText.trim()) return;
    setPasteLoading(true);
    setError('');
    try {
      const parsed = await parseRawTextIngredients(pastedText);
      setPreviewName(parsed.name);
      setPreviewIngredients(parsed.ingredients);
      setPreviewSteps(parsed.steps);
      setPreviewServings(parsed.servings);
      setPreviewCookedWeight(String(parsed.estimatedCookedWeight || ''));
      setPreviewSourceUrl(undefined);
      setPreviewNotes('Importat prin Smart Paste');
      setHasPreview(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPasteLoading(false);
    }
  };

  const handleJsonUpload = async (file: File) => {
    setJsonLoading(true);
    setError('');
    setJsonStatus(null);
    try {
      const text = await file.text();
      const parsed = parseRecipeJson(text);

      if (parsed.single) {
        const r = parsed.single as Recipe;
        if (!r.name || !Array.isArray(r.ingredients)) {
          throw new Error('Fișierul nu conține o rețetă Metric validă.');
        }
        const saved = await saveRecipe({
          name: r.name,
          ingredients: r.ingredients,
          steps: r.steps,
          tags: r.tags,
          servings: r.servings || 1,
          cookedWeightTotal: r.cookedWeightTotal || 500,
          sourceUrl: r.sourceUrl,
          notes: r.notes,
        });
        onImported(saved);
        onClose();
        return;
      }

      if (parsed.batch) {
        let count = 0;
        await db.transaction('rw', db.recipes, async () => {
          for (const item of parsed.batch!) {
            const r = item as Recipe;
            if (r.name && Array.isArray(r.ingredients)) {
              await db.recipes.put({
                ...r,
                id: r.id || crypto.randomUUID(),
                status: r.status || 'published',
                createdAt: r.createdAt || Date.now(),
                audit: r.audit || { createdAt: Date.now(), updatedAt: Date.now(), timesLogged: 0 },
              });
              count++;
            }
          }
        });
        setJsonStatus(`Au fost importate cu succes ${count} rețete.`);
        setTimeout(() => onClose(), 1200);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJsonLoading(false);
    }
  };

  const handleSavePreview = async (status: 'published' | 'draft' = 'published') => {
    if (!previewName.trim()) {
      setError('Te rugăm să introduci un nume pentru rețetă.');
      return;
    }
    const rawTotal = previewIngredients.reduce((s, i) => s + i.rawGrams, 0);
    const cookedTotal = parseFloat(previewCookedWeight) || Math.round(rawTotal * 0.9) || 100;

    try {
      const saved = await saveRecipe({
        name: previewName.trim(),
        status,
        ingredients: previewIngredients,
        steps: previewSteps,
        servings: previewServings,
        cookedWeightTotal: cookedTotal,
        sourceUrl: previewSourceUrl,
        notes: previewNotes,
      });
      onImported(saved);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-lg p-5 pb-8 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h2 className="text-base font-bold text-white">Importă Rețetă</h2>
          </div>
          <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">×</button>
        </div>

        {/* Butoane Tab */}
        {!hasPreview && (
          <div className="flex gap-2 mb-4 bg-zinc-950/70 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => { setTab('url'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${tab === 'url' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
            >
              🌐 Link Web
            </button>
            <button
              onClick={() => { setTab('paste'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${tab === 'paste' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
            >
              📝 Smart Paste
            </button>
            <button
              onClick={() => { setTab('json'); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${tab === 'json' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400 hover:text-white'}`}
            >
              📁 Fișier JSON
            </button>
          </div>
        )}

        {/* Erori generale */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl mb-4 leading-relaxed">
            {error}
          </div>
        )}

        {/* Vizualizare și editare înainte de salvare */}
        {hasPreview ? (
          <div className="space-y-4">
            <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
              <div className="flex justify-between items-start gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Nume preparat</label>
                  <input
                    type="text"
                    value={previewName}
                    onChange={(e) => setPreviewName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-sm font-bold text-white"
                  />
                </div>
                <div className="w-20">
                  <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Porții</label>
                  <input
                    type="number"
                    min="1"
                    value={previewServings}
                    onChange={(e) => setPreviewServings(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-center font-mono text-sm text-white"
                  />
                </div>
              </div>

              {/* Ingrediente detectate */}
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1.5">
                  Ingrediente detectate ({previewIngredients.length})
                </span>
                <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {previewIngredients.map((ing, idx) => (
                    <li key={idx} className="flex justify-between items-center text-xs bg-zinc-900/80 px-2.5 py-1.5 rounded-lg">
                      <span className="text-zinc-200">
                        {ing.name}
                        {ing.foodId && <span className="ml-1.5 text-[10px] text-emerald-400 font-mono">✓ recunoscut</span>}
                      </span>
                      <span className="font-mono text-zinc-400">{ing.rawGrams}g</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pași detectați */}
              {previewSteps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-zinc-800/70">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1.5">
                    Pași de preparare ({previewSteps.length})
                  </span>
                  <ol className="space-y-1 max-h-28 overflow-y-auto text-xs text-zinc-300 pr-1 list-decimal list-inside">
                    {previewSteps.map((st) => (
                      <li key={st.stepNumber} className="py-0.5">{st.instruction}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">Greutate gătită estimată</span>
                <span className="text-[10px] text-zinc-500">Puteți ajusta după cântărirea finală</span>
              </div>
              <div className="flex items-center gap-1.5 w-24">
                <input
                  type="number"
                  value={previewCookedWeight}
                  onChange={(e) => setPreviewCookedWeight(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-right font-mono text-sm text-white"
                />
                <span className="text-xs text-zinc-500">g</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleSavePreview('published')}
                className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs transition"
              >
                Salvează Rețeta
              </button>
              <button
                onClick={() => handleSavePreview('draft')}
                className="px-4 h-11 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold rounded-xl text-xs transition"
              >
                Salvează Ciornă
              </button>
            </div>
            <button
              onClick={() => setHasPreview(false)}
              className="w-full h-8 text-zinc-400 text-xs hover:text-white"
            >
              ← Modifică sursa de import
            </button>
          </div>
        ) : (
          <div>
            {/* Tab 1: URL */}
            {tab === 'url' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Introdu link-ul oricărui blog sau site culinar (ex: JamilaCuisine, BBC Good Food, AllRecipes, etc.). Vom extrage automat ingredientele și instrucțiunile.
                </p>
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="https://site-retete.ro/nume-reteta"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleFetchUrl(); }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                  />
                  <button
                    onClick={handleFetchUrl}
                    disabled={!url.trim() || urlLoading}
                    className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
                  >
                    {urlLoading ? (
                      <>
                        <span className="animate-spin text-sm">⏳</span>
                        <span>Se descarcă și se parsează rețeta...</span>
                      </>
                    ) : (
                      'Extrage Rețeta'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Smart Paste */}
            {tab === 'paste' && (
              <div className="space-y-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Lipește descrierea rețetei copiată din <span className="text-white font-semibold">Instagram, TikTok, WhatsApp</span> sau orice text liber. Vom curăța hashtag-urile și vom deduce gramajele.
                </p>
                <textarea
                  rows={6}
                  placeholder={`Exemplu:\n300g piept de pui\n150g orez basmati\n1 ceapa (100g)\n2 linguri ulei de masline\n\nMod de preparare:\n1. Fierbe orezul in apa cu sare\n2. Caleste puiul in ulei`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 font-mono resize-none focus:border-emerald-500/50 outline-none"
                />
                <button
                  onClick={handleParseText}
                  disabled={!pastedText.trim() || pasteLoading}
                  className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-xs transition"
                >
                  {pasteLoading ? 'Se analizează ingredientele...' : 'Analizează Textul'}
                </button>
              </div>
            )}

            {/* Tab 3: JSON */}
            {tab === 'json' && (
              <div className="space-y-3 text-center py-4">
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  Încarcă un fișier de rețetă individuală sau un pachet cu mai multe rețete (Recipe Pack) exportat din Metric.
                </p>
                <label className="block cursor-pointer bg-zinc-950 border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 rounded-2xl p-6 transition">
                  <span className="text-3xl block mb-2">📥</span>
                  <span className="text-xs font-semibold text-zinc-300 block">
                    {jsonLoading ? 'Se importă...' : 'Apasă pentru a alege un fișier .json'}
                  </span>
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleJsonUpload(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                {jsonStatus && <p className="text-xs text-emerald-400 mt-2">{jsonStatus}</p>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
