import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Clock3, Heart, Plus, Search, Star, Trash2, Zap } from 'lucide-react';
import { Button, Input, Label, NumberInput, Segmented, Sheet, SourceBadge } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import type { DateKey, FoodItem, LogEntry, Nutrients } from '@/db/types';
import { createCustomFood, toggleFavorite } from '@/lib/foods';
import { useFavoriteFoods, useFrequentFoods, useIsFavorite, useRecentFoods } from '@/lib/foods/hooks';
import { addLogEntry, deleteLogEntry, quickAdd, moveLogEntry, updateLogEntryGrams } from '@/lib/log/actions';
import { searchFoods } from '@/lib/food-sources/search';
import { scale } from '@/lib/utils/nutrients';
import { logSavedMeal } from '@/lib/recipes/actions';
import { fmtG, fmtKcal } from './format';
import { useAddFoodTabs } from './registry';

type BuiltInTab = 'search' | 'library' | 'quick' | 'new';
type SheetTab = BuiltInTab | string;

const BUILT_IN_TABS: { id: BuiltInTab; label: string }[] = [
  { id: 'search', label: 'Search' },
  { id: 'library', label: 'Library' },
  { id: 'quick', label: 'Quick add' },
  { id: 'new', label: 'New food' },
];

function validNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function FoodRow({ food, onSelect }: { food: FoodItem; onSelect: (food: FoodItem) => void }) {
  const favorite = useIsFavorite(food.id);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-surface-2">
      <button type="button" onClick={() => onSelect(food)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{food.name}</span>
          <SourceBadge source={food.source} />
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {[food.brand, `${fmtKcal(food.per100.kcal)} kcal / 100 ${food.unit ?? 'g'}`].filter(Boolean).join(' · ')}
        </div>
        <div className="mt-0.5 text-xs text-muted">P {fmtG(food.per100.protein)} · C {fmtG(food.per100.carbs)} · F {fmtG(food.per100.fat)}</div>
      </button>
      <button
        type="button"
        aria-label={favorite ? `Remove ${food.name} from favourites` : `Add ${food.name} to favourites`}
        aria-pressed={favorite}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await toggleFavorite(food);
          } finally {
            setBusy(false);
          }
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface"
      >
        <Star size={18} fill={favorite ? 'currentColor' : 'none'} className={favorite ? 'text-warning' : undefined} />
      </button>
    </div>
  );
}

function FoodAmount({ food, date, meal, onBack, onLogged }: {
  food: FoodItem;
  date: DateKey;
  meal: number;
  onBack: () => void;
  onLogged: () => void;
}) {
  const [grams, setGrams] = useState<number | undefined>(food.servings[0]?.grams ?? 100);
  const [servingIndex, setServingIndex] = useState<number | undefined>(food.servings.length ? 0 : undefined);
  const [saving, setSaving] = useState(false);
  const total = grams === undefined ? undefined : scale(food.per100, grams);

  const chooseServing = (value: string) => {
    if (value === '') {
      setServingIndex(undefined);
      return;
    }
    const index = Number(value);
    const serving = food.servings[index];
    if (!serving) return;
    setServingIndex(index);
    setGrams(serving.grams);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button type="button" onClick={onBack} className="mb-2 text-sm text-muted hover:text-text">Back to food list</button>
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 truncate text-lg font-semibold">{food.name}</h3>
          <SourceBadge source={food.source} />
        </div>
        {food.brand && <div className="text-sm text-muted">{food.brand}</div>}
      </div>

      {food.servings.length > 0 && (
        <div>
          <Label>Serving</Label>
          <select
            value={servingIndex === undefined ? '' : String(servingIndex)}
            onChange={(e) => chooseServing(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 outline-none focus:border-primary"
          >
            <option value="">Custom amount</option>
            {food.servings.map((serving, index) => <option key={`${serving.label}-${index}`} value={index}>{serving.label} ({fmtG(serving.grams)} {food.unit ?? 'g'})</option>)}
          </select>
        </div>
      )}

      <div>
        <Label>Amount</Label>
        <NumberInput
          aria-label="Food amount"
          value={grams}
          onValue={(value) => {
            setGrams(value);
            setServingIndex(undefined);
          }}
          suffix={food.unit ?? 'g'}
          autoFocus
        />
      </div>

      {total && (
        <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center">
          <div><div className="font-semibold text-kcal">{fmtKcal(total.kcal)}</div><div className="text-xs text-muted">kcal</div></div>
          <div><div className="font-semibold text-protein">{fmtG(total.protein)}g</div><div className="text-xs text-muted">protein</div></div>
          <div><div className="font-semibold text-carbs">{fmtG(total.carbs)}g</div><div className="text-xs text-muted">carbs</div></div>
          <div><div className="font-semibold text-fat">{fmtG(total.fat)}g</div><div className="text-xs text-muted">fat</div></div>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        disabled={!validNumber(grams) || saving}
        onClick={async () => {
          if (!validNumber(grams)) return;
          setSaving(true);
          try {
            await addLogEntry({ date, meal, food, grams, servingLabel: servingIndex === undefined ? undefined : food.servings[servingIndex]?.label });
            onLogged();
          } finally {
            setSaving(false);
          }
        }}
      >
        Add to log
      </Button>
    </div>
  );
}

function SearchTab({ onSelect }: { onSelect: (food: FoodItem) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      searchFoods(query).then((foods) => active && setResults(foods)).catch(() => active && setResults([]));
    }, query.trim() ? 180 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods" className="pl-10" autoFocus />
      </label>
      {results === undefined && <div className="py-8 text-center text-sm text-muted">Searching…</div>}
      {results?.length === 0 && <div className="py-8 text-center text-sm text-muted">No foods found. Create one or use Quick add.</div>}
      {results && results.length > 0 && <div className="divide-y divide-border">{results.map((food) => <FoodRow key={food.id} food={food} onSelect={onSelect} />)}</div>}
    </div>
  );
}

function LibrarySection({ title, icon, foods, onSelect }: { title: string; icon: ReactNode; foods: FoodItem[] | undefined; onSelect: (food: FoodItem) => void }) {
  if (foods === undefined) return null;
  if (foods.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 px-2 text-sm font-medium text-muted">{icon}{title}</h3>
      <div className="divide-y divide-border">{foods.map((food) => <FoodRow key={food.id} food={food} onSelect={onSelect} />)}</div>
    </section>
  );
}

function LibraryTab({ date, meal, onLogged, onSelect }: { date: DateKey; meal: number; onLogged: () => void; onSelect: (food: FoodItem) => void }) {
  const recents = useRecentFoods(10);
  const frequent = useFrequentFoods(10);
  const favourites = useFavoriteFoods();
  const savedMeals = useLiveQuery(() => db.savedMeals.orderBy('updatedAt').reverse().toArray().then((items) => items.filter(alive)), []);
  const [savingMealId, setSavingMealId] = useState<string | null>(null);
  const hasFood = (recents?.length ?? 0) + (frequent?.length ?? 0) + (favourites?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      {!hasFood && recents !== undefined && frequent !== undefined && favourites !== undefined && <div className="py-8 text-center text-sm text-muted">Foods you use and favourite will appear here.</div>}
      <LibrarySection title="Recent" icon={<Clock3 size={15} />} foods={recents} onSelect={onSelect} />
      <LibrarySection title="Frequent" icon={<Zap size={15} />} foods={frequent} onSelect={onSelect} />
      <LibrarySection title="Favourites" icon={<Heart size={15} />} foods={favourites} onSelect={onSelect} />
      {savedMeals && savedMeals.length > 0 && <section><h3 className="mb-1 px-2 text-sm font-medium text-muted">Saved meals</h3><div className="divide-y divide-border">{savedMeals.map((savedMeal) => <button key={savedMeal.id} type="button" disabled={savingMealId !== null} onClick={async () => { setSavingMealId(savedMeal.id); try { await logSavedMeal(savedMeal, date, meal); onLogged(); } finally { setSavingMealId(null); } }} className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2 disabled:opacity-50"><span className="min-w-0"><span className="block truncate font-medium">{savedMeal.name}</span><span className="text-xs text-muted">{savedMeal.items.length} foods</span></span><Plus size={18} className="shrink-0 text-primary" /></button>)}</div></section>}
    </div>
  );
}

function QuickAddTab({ date, meal, onLogged }: { date: DateKey; meal: number; onLogged: () => void }) {
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState<number | undefined>();
  const [protein, setProtein] = useState<number | undefined>();
  const [carbs, setCarbs] = useState<number | undefined>();
  const [fat, setFat] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Add calories and macros without saving a food.</p>
      <div><Label hint="Optional">Name</Label><Input aria-label="Quick add name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Restaurant lunch" /></div>
      <div><Label>Calories</Label><NumberInput aria-label="Quick add calories" value={kcal} onValue={setKcal} suffix="kcal" autoFocus /></div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label>Protein</Label><NumberInput aria-label="Quick add protein" value={protein} onValue={setProtein} suffix="g" /></div>
        <div><Label>Carbs</Label><NumberInput aria-label="Quick add carbs" value={carbs} onValue={setCarbs} suffix="g" /></div>
        <div><Label>Fat</Label><NumberInput aria-label="Quick add fat" value={fat} onValue={setFat} suffix="g" /></div>
      </div>
      <Button
        variant="primary"
        size="lg"
        disabled={!validNumber(kcal) || !validNumber(protein ?? 0) || !validNumber(carbs ?? 0) || !validNumber(fat ?? 0) || saving}
        onClick={async () => {
          if (!validNumber(kcal)) return;
          setSaving(true);
          try {
            await quickAdd({ date, meal, name, kcal, protein, carbs, fat });
            onLogged();
          } finally {
            setSaving(false);
          }
        }}
      >
        Add to log
      </Button>
    </div>
  );
}

function NewFoodTab({ onSelect }: { onSelect: (food: FoodItem) => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState<'g' | 'ml'>('g');
  const [kcal, setKcal] = useState<number | undefined>();
  const [protein, setProtein] = useState<number | undefined>(0);
  const [carbs, setCarbs] = useState<number | undefined>(0);
  const [fat, setFat] = useState<number | undefined>(0);
  const [servingLabel, setServingLabel] = useState('');
  const [servingGrams, setServingGrams] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);
  const canSave = name.trim().length > 0 && validNumber(kcal) && validNumber(protein) && validNumber(carbs) && validNumber(fat) && (!servingLabel.trim() || validNumber(servingGrams));

  return (
    <div className="flex flex-col gap-4">
      <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Food name" autoFocus /></div>
      <div><Label hint="Optional">Brand</Label><Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Albert Heijn" /></div>
      <div><Label>Unit</Label><Segmented options={[{ value: 'g', label: 'Grams' }, { value: 'ml', label: 'Millilitres' }]} value={unit} onChange={setUnit} /></div>
      <div>
        <Label>Per 100 {unit}</Label>
        <div className="grid grid-cols-4 gap-2">
          <NumberInput value={kcal} onValue={setKcal} suffix="kcal" aria-label="Calories per 100" />
          <NumberInput value={protein} onValue={setProtein} suffix="P" aria-label="Protein per 100" />
          <NumberInput value={carbs} onValue={setCarbs} suffix="C" aria-label="Carbs per 100" />
          <NumberInput value={fat} onValue={setFat} suffix="F" aria-label="Fat per 100" />
        </div>
      </div>
      <div>
        <Label hint="Optional">Custom serving</Label>
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <Input value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder="e.g. 1 roll" />
          <NumberInput value={servingGrams} onValue={setServingGrams} suffix={unit} aria-label="Custom serving amount" />
        </div>
      </div>
      <Button
        variant="primary"
        size="lg"
        disabled={!canSave || saving}
        onClick={async () => {
          if (!canSave || !validNumber(kcal) || !validNumber(protein) || !validNumber(carbs) || !validNumber(fat)) return;
          setSaving(true);
          try {
            const per100: Nutrients = { kcal, protein, carbs, fat };
            const food = await createCustomFood({
              name,
              brand: brand.trim() || undefined,
              unit,
              per100,
              servings: servingLabel.trim() && validNumber(servingGrams) ? [{ label: servingLabel.trim(), grams: servingGrams }] : [],
            });
            onSelect(food);
          } finally {
            setSaving(false);
          }
        }}
      >
        <Plus size={18} /> Create food
      </Button>
    </div>
  );
}

export function AddFoodSheet({ open, onClose, date, meal, initialTab }: {
  open: boolean;
  onClose: () => void;
  date: DateKey;
  meal: number;
  initialTab?: string;
}) {
  const extensions = useAddFoodTabs();
  const availableTabs = useMemo(() => [...BUILT_IN_TABS, ...extensions], [extensions]);
  const [tab, setTab] = useState<SheetTab>('search');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedFood(null);
    setTab(availableTabs.some((candidate) => candidate.id === initialTab) ? initialTab! : 'search');
  }, [open, initialTab, availableTabs]);

  const close = () => {
    setSelectedFood(null);
    onClose();
  };
  const logged = () => close();

  const body = selectedFood ? (
    <FoodAmount food={selectedFood} date={date} meal={meal} onBack={() => setSelectedFood(null)} onLogged={logged} />
  ) : (
    <>
      <Segmented options={availableTabs.map((candidate) => ({ value: candidate.id, label: candidate.label }))} value={tab} onChange={setTab} className="mb-4 overflow-x-auto" />
      {tab === 'search' && <SearchTab onSelect={setSelectedFood} />}
      {tab === 'library' && <LibraryTab date={date} meal={meal} onLogged={logged} onSelect={setSelectedFood} />}
      {tab === 'quick' && <QuickAddTab date={date} meal={meal} onLogged={logged} />}
      {tab === 'new' && <NewFoodTab onSelect={setSelectedFood} />}
      {extensions.filter((candidate) => candidate.id === tab).map((candidate) => <div key={candidate.id}>{candidate.render({ date, meal, onLogged: logged, openFood: setSelectedFood })}</div>)}
    </>
  );

  return <Sheet open={open} onClose={close} title={selectedFood ? 'Add food' : 'Add food'} wide>{body}</Sheet>;
}

export function FoodDetailSheet({ open, onClose, entry, date, meal, onDone }: {
  open: boolean;
  onClose: () => void;
  entry?: LogEntry;
  date: DateKey;
  meal: number;
  onDone: () => void;
}) {
  const settings = useSettings();
  const [grams, setGrams] = useState<number | undefined>(entry?.grams);
  const [nextDate, setNextDate] = useState<DateKey>(date);
  const [nextMeal, setNextMeal] = useState(meal);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setGrams(entry?.grams);
    setNextDate(entry?.date ?? date);
    setNextMeal(entry?.meal ?? meal);
    setConfirmDelete(false);
  }, [entry, date, meal]);

  if (!entry) return null;
  const mealOptions = settings.mealNames.map((name, index) => ({ name, index }));
  if (!mealOptions.some((option) => option.index === entry.meal)) mealOptions.push({ name: 'Other', index: entry.meal });
  const total = grams === undefined ? undefined : entry.per100 ? scale(entry.per100, grams) : undefined;

  const done = () => {
    onClose();
    onDone();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Edit food">
      <div key={entry.id} className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2"><h3 className="font-semibold">{entry.name}</h3><SourceBadge source={entry.source} /></div>
          {entry.brand && <div className="text-sm text-muted">{entry.brand}</div>}
        </div>
        <div><Label>Amount</Label><NumberInput aria-label="Entry amount" value={grams} onValue={setGrams} suffix="g" autoFocus /></div>
        {total && <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center text-sm"><div className="text-kcal">{fmtKcal(total.kcal)}<div className="text-xs text-muted">kcal</div></div><div className="text-protein">{fmtG(total.protein)}g<div className="text-xs text-muted">protein</div></div><div className="text-carbs">{fmtG(total.carbs)}g<div className="text-xs text-muted">carbs</div></div><div className="text-fat">{fmtG(total.fat)}g<div className="text-xs text-muted">fat</div></div></div>}
        <div><Label>Date</Label><Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></div>
        <div>
          <Label>Meal</Label>
          <select value={nextMeal} onChange={(e) => setNextMeal(Number(e.target.value))} className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 outline-none focus:border-primary">
            {mealOptions.map((option) => <option key={option.index} value={option.index}>{option.name}</option>)}
          </select>
        </div>
        <Button
          variant="primary"
          size="lg"
          disabled={!validNumber(grams) || saving}
          onClick={async () => {
            if (!validNumber(grams)) return;
            setSaving(true);
            try {
              await updateLogEntryGrams(entry.id, grams);
              if (nextDate !== entry.date || nextMeal !== entry.meal) await moveLogEntry(entry.id, nextMeal, nextDate);
              done();
            } finally {
              setSaving(false);
            }
          }}
        >Save changes</Button>
        <Button
          variant="danger"
          disabled={saving}
          onClick={async () => {
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            setSaving(true);
            try {
              await deleteLogEntry(entry.id);
              done();
            } finally {
              setSaving(false);
            }
          }}
        ><Trash2 size={16} />{confirmDelete ? 'Tap again to delete' : 'Delete food'}</Button>
      </div>
    </Sheet>
  );
}

export { registerAddFoodTab, unregisterAddFoodTab, useAddFoodTabs } from './registry';
