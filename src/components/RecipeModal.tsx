import { useState, useEffect, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  saveRecipe,
  updateRecipe,
  deleteRecipe,
  duplicateRecipe,
  bulkDeleteRecipes,
  bulkSetRecipeStatus,
  logRecipeByGrams,
} from '../db/operations';
import { Recipe, RecipeIngredient, RecipeStep, RecipeStatus, MealType, FoodItem } from '../types/nutrition';
import { RecipeImportModal } from './RecipeImportModal';

interface Props {
  date: string;
  mealType: MealType;
  onClose: () => void;
}

type DraftIngredient = {
  id: string;
  name: string;
  rawGrams: string;
  caloriesPer100: string;
  proteinPer100: string;
  carbsPer100: string;
  fatPer100: string;
  foodId?: string;
};

const POPULAR_TAGS = ['High Protein', 'Meal Prep', 'Low Carb', 'Keto', 'Rapid', 'Desert'];

const emptyIngredient = (): DraftIngredient => ({
  id: crypto.randomUUID(),
  name: '',
  rawGrams: '100',
  caloriesPer100: '',
  proteinPer100: '',
  carbsPer100: '',
  fatPer100: '',
});

const DRAFT_STORAGE_KEY = 'metric_recipe_active_draft';

export function RecipeModal({ date, mealType, onClose }: Props) {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [showImportModal, setShowImportModal] = useState(false);

  // Date din Dexie
  const recipes = useLiveQuery(() => db.recipes.toArray()) ?? [];
  const allFoods = useLiveQuery(() => db.foods.toArray()) ?? [];

  // --- Filtrare, Sortare & Căutare ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RecipeStatus>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'cals_asc' | 'cals_desc' | 'logged' | 'recent'>('recent');

  // --- Selecție Multiplă (Bulk Actions) ---
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // --- Logare porție ---
  const [selectedForLog, setSelectedForLog] = useState<Recipe | null>(null);
  const [logGrams, setLogGrams] = useState('200');
  const [logError, setLogError] = useState('');

  // --- Formular Creare / Editare ---
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<RecipeStatus>('published');
  const [tags, setTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([emptyIngredient()]);
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [servings, setServings] = useState('2');
  const [cookedWeight, setCookedWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [autoSavedNotice, setAutoSavedNotice] = useState(false);
  const [hasSavedDraftOnMount, setHasSavedDraftOnMount] = useState(false);

  // Auto-completare alimente
  const [activeIngredientId, setActiveIngredientId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<FoodItem[]>([]);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);

  // Verificare draft salvat la mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name || (parsed?.ingredients && parsed.ingredients.length > 1)) {
          setHasSavedDraftOnMount(true);
        }
      }
    } catch {
      // ignorăm erori de storage
    }
  }, []);

  // Auto-save debounced când utilizatorul editează o rețetă nouă
  useEffect(() => {
    if (mode !== 'create') return;
    const hasData = name.trim() || ingredients.some((i) => i.name.trim());
    if (!hasData) return;

    const timer = setTimeout(() => {
      try {
        const payload = {
          name,
          status,
          tags,
          ingredients,
          steps,
          servings,
          cookedWeight,
          notes,
          savedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
        setAutoSavedNotice(true);
        setTimeout(() => setAutoSavedNotice(false), 2000);
      } catch {
        // depășire cotă storage, ignorăm
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [mode, name, status, tags, ingredients, steps, servings, cookedWeight, notes]);

  const restoreDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        setName(p.name || '');
        setStatus(p.status || 'draft');
        setTags(p.tags || []);
        if (Array.isArray(p.ingredients) && p.ingredients.length > 0) setIngredients(p.ingredients);
        if (Array.isArray(p.steps)) setSteps(p.steps);
        setServings(String(p.servings || '2'));
        setCookedWeight(p.cookedWeight || '');
        setNotes(p.notes || '');
        setHasSavedDraftOnMount(false);
        setMode('create');
      }
    } catch {
      setHasSavedDraftOnMount(false);
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setHasSavedDraftOnMount(false);
  };

  // --- Filtrare și Sortare Rețete ---
  const filteredRecipes = useMemo(() => {
    return recipes
      .filter((r) => {
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        if (selectedTag && !r.tags?.includes(selectedTag)) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = r.name.toLowerCase().includes(q);
          const matchTag = r.tags?.some((t) => t.toLowerCase().includes(q));
          const matchIngredient = r.ingredients?.some((i) => i.name.toLowerCase().includes(q));
          return matchName || matchTag || matchIngredient;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'cals_asc') return a.caloriesPer100Cooked - b.caloriesPer100Cooked;
        if (sortBy === 'cals_desc') return b.caloriesPer100Cooked - a.caloriesPer100Cooked;
        if (sortBy === 'logged') return (b.audit?.timesLogged ?? 0) - (a.audit?.timesLogged ?? 0);
        return (b.audit?.updatedAt ?? b.createdAt) - (a.audit?.updatedAt ?? a.createdAt);
      });
  }, [recipes, statusFilter, selectedTag, searchQuery, sortBy]);

  // --- Gestionare Sugestii Ingrediente din db.foods ---
  const handleIngredientNameChange = (id: string, text: string) => {
    updateIngredient(id, 'name', text);
    setActiveIngredientId(id);

    if (text.trim().length >= 2) {
      const q = text.toLowerCase();
      const matches = allFoods
        .filter((f) => f.name.toLowerCase().includes(q))
        .slice(0, 4);
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };

  const selectFoodSuggestion = (ingredientId: string, food: FoodItem) => {
    setIngredients((prev) =>
      prev.map((i) =>
        i.id === ingredientId
          ? {
              ...i,
              name: food.name,
              caloriesPer100: String(food.caloriesPer100),
              proteinPer100: String(food.proteinPer100),
              carbsPer100: String(food.carbsPer100),
              fatPer100: String(food.fatPer100),
              foodId: food.id,
            }
          : i
      )
    );
    setSuggestions([]);
    setActiveIngredientId(null);
  };

  const updateIngredient = (id: string, field: keyof Omit<DraftIngredient, 'id'>, value: string) => {
    setIngredients((prev) => prev.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing)));
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const rawTotal = ingredients.reduce((s, i) => {
    const v = parseFloat(i.rawGrams);
    return s + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);

  // --- Handlers Salvare & Editare ---
  const handleSaveRecipe = async () => {
    setFormError('');
    if (!name.trim()) {
      setFormError('Te rugăm să introduci numele rețetei.');
      return;
    }

    const parsedIngredients: RecipeIngredient[] = ingredients
      .filter((i) => i.name.trim() && parseFloat(i.rawGrams) > 0)
      .map((i) => ({
        id: i.id,
        name: i.name.trim(),
        rawGrams: parseFloat(i.rawGrams) || 0,
        caloriesPer100: parseFloat(i.caloriesPer100) || 0,
        proteinPer100: parseFloat(i.proteinPer100) || 0,
        carbsPer100: parseFloat(i.carbsPer100) || 0,
        fatPer100: parseFloat(i.fatPer100) || 0,
        foodId: i.foodId,
      }));

    if (parsedIngredients.length === 0) {
      setFormError('Adaugă cel puțin un ingredient valid cu gramaj.');
      return;
    }

    const finalCookedWeight = cookedWeight ? parseFloat(cookedWeight) : rawTotal;
    if (!Number.isFinite(finalCookedWeight) || finalCookedWeight <= 0) {
      setFormError('Greutatea gătită totală trebuie să fie un număr pozitiv.');
      return;
    }

    try {
      if (mode === 'edit' && editingRecipeId) {
        const original = recipes.find((r) => r.id === editingRecipeId);
        if (!original) throw new Error('Rețeta nu mai există.');
        await updateRecipe({
          ...original,
          name: name.trim(),
          status,
          tags,
          ingredients: parsedIngredients,
          steps,
          servings: Math.max(1, parseInt(servings, 10) || 1),
          cookedWeightTotal: finalCookedWeight,
          notes: notes.trim() || undefined,
        });
      } else {
        await saveRecipe({
          name: name.trim(),
          status,
          tags,
          ingredients: parsedIngredients,
          steps,
          servings: Math.max(1, parseInt(servings, 10) || 1),
          cookedWeightTotal: finalCookedWeight,
          notes: notes.trim() || undefined,
        });
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      resetForm();
      setMode('list');
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  const startEdit = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setName(recipe.name);
    setStatus(recipe.status || 'published');
    setTags(recipe.tags || []);
    setIngredients(
      recipe.ingredients.map((i) => ({
        id: i.id || crypto.randomUUID(),
        name: i.name,
        rawGrams: String(i.rawGrams),
        caloriesPer100: String(i.caloriesPer100),
        proteinPer100: String(i.proteinPer100),
        carbsPer100: String(i.carbsPer100),
        fatPer100: String(i.fatPer100),
        foodId: i.foodId,
      }))
    );
    setSteps(recipe.steps || []);
    setServings(String(recipe.servings || 2));
    setCookedWeight(String(recipe.cookedWeightTotal));
    setNotes(recipe.notes || '');
    setFormError('');
    setMode('edit');
  };

  const resetForm = () => {
    setEditingRecipeId(null);
    setName('');
    setStatus('published');
    setTags([]);
    setIngredients([emptyIngredient()]);
    setSteps([]);
    setServings('2');
    setCookedWeight('');
    setNotes('');
    setFormError('');
  };

  const handleLog = async () => {
    if (!selectedForLog) return;
    setLogError('');
    const grams = parseFloat(logGrams);
    if (!Number.isFinite(grams) || grams <= 0) {
      setLogError('Introdu un gramaj pozitiv valid.');
      return;
    }
    try {
      await logRecipeByGrams({ date, mealType, recipe: selectedForLog, grams });
      onClose();
    } catch (e) {
      setLogError((e as Error).message);
    }
  };

  // --- Handlers Bulk & Duplicare ---
  const toggleSelectRecipe = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleBulkDelete = async () => {
    if (confirm(`Ștergi definitiv ${selectedIds.length} rețete selectate?`)) {
      await bulkDeleteRecipes(selectedIds);
      setSelectedIds([]);
      setIsBulkMode(false);
    }
  };

  const handleBulkArchive = async () => {
    await bulkSetRecipeStatus(selectedIds, 'archived');
    setSelectedIds([]);
    setIsBulkMode(false);
  };

  const handleDuplicate = async (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await duplicateRecipe(recipe.id);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const handleExportJson = (recipe: Recipe, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recipe.name.replace(/\s+/g, '_').toLowerCase()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-end justify-center">
      <div className="bg-zinc-900 border-t border-zinc-800 rounded-t-3xl w-full max-w-lg p-5 pb-8 max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header principal */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">Rețete Culinare</h2>
            {recipes.length > 0 && (
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                {recipes.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 px-2.5 py-1 rounded-lg transition font-medium flex items-center gap-1"
            >
              <span>✨</span> Importă
            </button>
            <button onClick={onClose} aria-label="Închide" className="text-zinc-400 hover:text-white text-xl leading-none px-1">
              ×
            </button>
          </div>
        </div>

        {/* Tab-uri Navigare Mod */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setMode('list'); setSelectedForLog(null); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${
              mode === 'list' ? 'bg-zinc-100 text-zinc-950 border-white' : 'bg-zinc-800/60 text-zinc-400 border-transparent'
            }`}
          >
            Rețetele mele
          </button>
          <button
            onClick={() => { resetForm(); setMode('create'); }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition ${
              mode === 'create' || mode === 'edit' ? 'bg-zinc-100 text-zinc-950 border-white' : 'bg-zinc-800/60 text-zinc-400 border-transparent'
            }`}
          >
            {mode === 'edit' ? '✏️ Editare rețetă' : '+ Rețetă nouă'}
          </button>
        </div>

        {/* Alerte & Notificări Draft */}
        {hasSavedDraftOnMount && mode === 'list' && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs p-3 rounded-xl mb-3 flex justify-between items-center">
            <span>Ai o ciornă neterminată salvată automat.</span>
            <div className="flex gap-2">
              <button onClick={restoreDraft} className="font-bold underline">Restaurează</button>
              <button onClick={discardDraft} className="text-zinc-400 hover:text-zinc-200">Ignoră</button>
            </div>
          </div>
        )}

        {/* --- MOD: LISTĂ REȚETE --- */}
        {mode === 'list' && (
          selectedForLog ? (
            /* Detalii logare rețetă în jurnal */
            <div className="space-y-4">
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">{selectedForLog.name}</h3>
                    {selectedForLog.tags?.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {selectedForLog.tags.map((t) => (
                          <span key={t} className="text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(selectedForLog)}
                    className="text-xs text-sky-400 hover:underline bg-zinc-900 px-2 py-1 rounded border border-zinc-800"
                  >
                    Editează
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-zinc-800/60 font-mono text-center text-xs">
                  <div><span className="text-zinc-500 block">kcal/100g</span><span className="text-white font-bold">{selectedForLog.caloriesPer100Cooked}</span></div>
                  <div><span className="text-zinc-500 block">P</span><span className="text-sky-400 font-bold">{selectedForLog.proteinPer100Cooked}g</span></div>
                  <div><span className="text-zinc-500 block">C</span><span className="text-amber-400 font-bold">{selectedForLog.carbsPer100Cooked}g</span></div>
                  <div><span className="text-zinc-500 block">G</span><span className="text-indigo-400 font-bold">{selectedForLog.fatPer100Cooked}g</span></div>
                </div>
              </div>

              {/* Porție de adăugat */}
              <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">Porție consumată:</span>
                  <span className="text-[10px] text-zinc-500">Gramaj cântărit din farfurie</span>
                </div>
                <div className="flex items-center gap-1.5 w-24">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={logGrams}
                    onChange={(e) => setLogGrams(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-right font-mono text-sm text-white"
                  />
                  <span className="text-xs text-zinc-500">g</span>
                </div>
              </div>

              {logError && <p className="text-xs text-rose-400">{logError}</p>}

              <button
                onClick={handleLog}
                className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm transition"
              >
                Adaugă în Jurnal ({Math.round(selectedForLog.caloriesPer100Cooked * ((parseFloat(logGrams) || 0) / 100))} kcal)
              </button>
              <button
                onClick={() => setSelectedForLog(null)}
                className="w-full h-8 text-zinc-400 text-xs hover:text-white"
              >
                ← Înapoi la listă
              </button>
            </div>
          ) : (
            /* Lista propriu-zisă cu căutare, filtrare și acțiuni în masă */
            <div className="space-y-3">
              {/* Bară căutare & mod bulk */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Caută după nume, ingredient sau tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-600"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-zinc-500 hover:text-white text-xs"
                    >
                      ×
                    </button>
                  )}
                </div>
                <button
                  onClick={() => { setIsBulkMode(!isBulkMode); setSelectedIds([]); }}
                  className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition ${
                    isBulkMode ? 'bg-zinc-200 text-zinc-950 border-white' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  {isBulkMode ? 'Gata' : 'Selecție'}
                </button>
              </div>

              {/* Filtre Status & Sortare */}
              <div className="flex justify-between items-center gap-2 overflow-x-auto pb-1 text-xs">
                <div className="flex gap-1.5 flex-nowrap">
                  {(['all', 'published', 'draft', 'archived'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`px-2 py-1 rounded-lg capitalize whitespace-nowrap transition text-[11px] ${
                        statusFilter === st ? 'bg-zinc-800 text-white font-bold' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {st === 'all' ? 'Toate' : st === 'published' ? 'Publicate' : st === 'draft' ? 'Ciorne' : 'Arhivate'}
                    </button>
                  ))}
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as never)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-300 outline-none"
                >
                  <option value="recent">Recente</option>
                  <option value="logged">Cele mai gătite</option>
                  <option value="name">Nume (A-Z)</option>
                  <option value="cals_asc">Calorii ↑</option>
                  <option value="cals_desc">Calorii ↓</option>
                </select>
              </div>

              {/* Tag chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {POPULAR_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap transition ${
                      selectedTag === tag
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>

              {/* Bară Acțiuni în Masă (Bulk Bar) */}
              {isBulkMode && selectedIds.length > 0 && (
                <div className="bg-zinc-950 border border-zinc-800 p-2 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                  <span className="font-semibold text-zinc-300 ml-1">{selectedIds.length} selectate</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleBulkArchive}
                      className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px]"
                    >
                      Arhivează
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-lg text-[11px]"
                    >
                      Șterge
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de carduri rețete */}
              {filteredRecipes.length === 0 ? (
                <div className="text-center py-10 bg-zinc-950/40 border border-zinc-800/40 rounded-2xl p-6">
                  <span className="text-3xl block mb-2">🍳</span>
                  <p className="text-xs text-zinc-400 font-semibold mb-1">Nicio rețetă găsită.</p>
                  <p className="text-[11px] text-zinc-600 mb-4">
                    {searchQuery ? 'Încearcă alt termen de căutare.' : 'Creează o rețetă nouă sau importă una de pe net!'}
                  </p>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold"
                  >
                    ✨ Importă o rețetă
                  </button>
                </div>
              ) : (
                <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredRecipes.map((r) => (
                    <li
                      key={r.id}
                      onClick={() => (!isBulkMode ? setSelectedForLog(r) : toggleSelectRecipe(r.id))}
                      className={`bg-zinc-950 border rounded-xl p-3 flex flex-col gap-2 cursor-pointer transition ${
                        selectedIds.includes(r.id)
                          ? 'border-emerald-500/80 bg-emerald-950/10'
                          : 'border-zinc-800/70 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          {isBulkMode && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(r.id)}
                              onChange={() => toggleSelectRecipe(r.id)}
                              className="accent-emerald-500 rounded"
                            />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-white">{r.name}</span>
                              {r.status === 'draft' && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded font-mono">
                                  Draft
                                </span>
                              )}
                              {r.status === 'archived' && (
                                <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1 py-0.2 rounded font-mono">
                                  Arhivat
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-zinc-500 font-mono block">
                              {r.ingredients.length} ingrediente · {r.cookedWeightTotal}g preparat
                              {r.audit?.timesLogged ? ` · gătit de ${r.audit.timesLogged}×` : ''}
                            </span>
                          </div>
                        </div>

                        {/* Meniu rapid acțiuni */}
                        {!isBulkMode && (
                          <div className="flex items-center gap-1 text-zinc-500">
                            <button
                              onClick={(e) => handleDuplicate(r, e)}
                              title="Duplică rețetă"
                              className="hover:text-white p-1 text-xs"
                            >
                              📋
                            </button>
                            <button
                              onClick={(e) => handleExportJson(r, e)}
                              title="Exportă JSON"
                              className="hover:text-white p-1 text-xs"
                            >
                              📥
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Ștergi definitiv ${r.name}?`)) deleteRecipe(r.id);
                              }}
                              title="Șterge"
                              className="hover:text-rose-400 p-1 text-sm leading-none"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Macronutrienți / 100g */}
                      <div className="flex justify-between items-center pt-2 border-t border-zinc-900 text-xs font-mono">
                        <span className="font-bold text-white">{r.caloriesPer100Cooked} kcal<span className="text-[10px] text-zinc-500 font-normal">/100g</span></span>
                        <div className="flex gap-2 text-[11px]">
                          <span className="text-sky-400 font-semibold">P:{r.proteinPer100Cooked}g</span>
                          <span className="text-amber-400 font-semibold">C:{r.carbsPer100Cooked}g</span>
                          <span className="text-indigo-400 font-semibold">G:{r.fatPer100Cooked}g</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        )}

        {/* --- MOD: CREARE / EDITARE REȚETĂ --- */}
        {(mode === 'create' || mode === 'edit') && (
          <div className="space-y-4">
            {/* Titlu & Indicator Auto-Save */}
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                {mode === 'edit' ? 'Editează Rețeta' : 'Compune Rețetă'}
              </span>
              {autoSavedNotice && (
                <span className="text-[10px] text-emerald-400 font-mono animate-pulse">
                  💾 Ciornă salvată automat
                </span>
              )}
            </div>

            {/* Câmp Nume & Status */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nume rețetă (ex. Pui cu orez basmati)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white font-medium"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as RecipeStatus)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-2 text-xs text-zinc-300 outline-none"
              >
                <option value="published">Publicată</option>
                <option value="draft">Ciornă (Draft)</option>
              </select>
            </div>

            {/* Tag-uri */}
            <div>
              <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1.5">Etichete / Tag-uri</label>
              <div className="flex gap-1.5 flex-wrap items-center">
                {POPULAR_TAGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
                    className={`text-[10px] px-2 py-0.5 rounded-lg border transition ${
                      tags.includes(t)
                        ? 'bg-emerald-500 text-zinc-950 font-bold border-emerald-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    #{t}
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="+ Tag"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customTagInput.trim()) {
                        e.preventDefault();
                        if (!tags.includes(customTagInput.trim())) setTags([...tags, customTagInput.trim()]);
                        setCustomTagInput('');
                      }
                    }}
                    className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-0.5 text-[10px] text-white"
                  />
                </div>
              </div>
            </div>

            {/* Secțiune Ingrediente */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-zinc-500">
                  Ingrediente crude (total: {Math.round(rawTotal)}g)
                </span>
                <span className="text-[10px] text-zinc-500">kcal · P · C · G la 100g</span>
              </div>

              {ingredients.map((ing) => (
                <div key={ing.id} className="relative bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 space-y-2">
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <input
                        placeholder="Nume ingredient (caută în catalog...)"
                        value={ing.name}
                        onChange={(e) => handleIngredientNameChange(ing.id, e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      />
                      {/* Dropdown Auto-Completare din baza de date locală */}
                      {activeIngredientId === ing.id && suggestions.length > 0 && (
                        <div
                          ref={suggestionsRef}
                          className="absolute left-0 right-0 top-full mt-1 z-20 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden"
                        >
                          {suggestions.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => selectFoodSuggestion(ing.id, f)}
                              className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800 flex justify-between items-center border-b border-zinc-800 last:border-0"
                            >
                              <span>{f.name}</span>
                              <span className="font-mono text-[10px] text-emerald-400">{f.caloriesPer100} kcal/100g</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="g crud"
                      value={ing.rawGrams}
                      onChange={(e) => updateIngredient(ing.id, 'rawGrams', e.target.value)}
                      className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono text-right"
                    />

                    {ingredients.length > 1 && (
                      <button
                        onClick={() => removeIngredient(ing.id)}
                        className="text-zinc-500 hover:text-rose-400 text-base px-1 leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Câmpuri macronutrienți / 100g */}
                  <div className="grid grid-cols-4 gap-1.5">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="kcal/100g"
                      value={ing.caloriesPer100}
                      onChange={(e) => updateIngredient(ing.id, 'caloriesPer100', e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-[11px] text-white font-mono"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="P/100g"
                      value={ing.proteinPer100}
                      onChange={(e) => updateIngredient(ing.id, 'proteinPer100', e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-[11px] text-sky-400 font-mono"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="C/100g"
                      value={ing.carbsPer100}
                      onChange={(e) => updateIngredient(ing.id, 'carbsPer100', e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-[11px] text-amber-400 font-mono"
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="G/100g"
                      value={ing.fatPer100}
                      onChange={(e) => updateIngredient(ing.id, 'fatPer100', e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-[11px] text-indigo-400 font-mono"
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => setIngredients((prev) => [...prev, emptyIngredient()])}
                className="w-full h-9 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 text-xs rounded-lg transition"
              >
                + Adaugă ingredient
              </button>
            </div>

            {/* Greutate gătită & Porții */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                <span className="text-xs font-semibold text-zinc-300 block mb-1">Greutate gătită</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={String(Math.round(rawTotal) || '')}
                    value={cookedWeight}
                    onChange={(e) => setCookedWeight(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-right font-mono text-sm text-white"
                  />
                  <span className="text-xs text-zinc-500">g</span>
                </div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                <span className="text-xs font-semibold text-zinc-300 block mb-1">Număr porții</span>
                <input
                  type="number"
                  min="1"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-right font-mono text-sm text-white"
                />
              </div>
            </div>

            {/* Pași de preparare */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Instrucțiuni de preparare</span>
                <button
                  type="button"
                  onClick={() => setSteps((prev) => [...prev, { stepNumber: prev.length + 1, instruction: '' }])}
                  className="text-[11px] text-emerald-400 hover:underline"
                >
                  + Adaugă pas
                </button>
              </div>
              {steps.map((st, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-zinc-950 p-2 rounded-xl border border-zinc-800/60">
                  <span className="text-xs font-mono font-bold text-zinc-500 w-5 text-center">{idx + 1}.</span>
                  <input
                    type="text"
                    placeholder={`Pasul ${idx + 1}...`}
                    value={st.instruction}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, instruction: val } : s)));
                    }}
                    className="flex-1 bg-transparent text-xs text-white outline-none"
                  />
                  <button
                    onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepNumber: i + 1 })))}
                    className="text-zinc-500 hover:text-rose-400 text-sm px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {formError && <p className="text-xs text-rose-400">{formError}</p>}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveRecipe}
                className="flex-1 h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-sm transition"
              >
                {mode === 'edit' ? 'Actualizează Rețeta' : 'Salvează Rețeta'}
              </button>
              <button
                type="button"
                onClick={() => { resetForm(); setMode('list'); }}
                className="px-4 h-11 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl text-xs transition"
              >
                Anulează
              </button>
            </div>
          </div>
        )}

        {/* Modal Import */}
        {showImportModal && (
          <RecipeImportModal
            onClose={() => setShowImportModal(false)}
            onImported={(imported) => {
              setSelectedForLog(imported);
              setMode('list');
            }}
          />
        )}
      </div>
    </div>
  );
}
