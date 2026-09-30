import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Plus } from 'lucide-react';
import { Button, Card, Input, Sheet } from '@/components/ui';
import type { DateKey, LogEntry } from '@/db/types';
import { addDays } from '@/lib/utils/date';
import { copyMeal, groupLogEntries } from '@/lib/log/actions';
import { saveLogEntriesAsMeal, saveLogEntriesAsRecipe } from '@/lib/recipes/actions';
import { SaveAsRecipeForm } from '@/features/recipes/SaveAsRecipeForm';
import { EntryRow } from './EntryRow';
import { GroupRow, toRows } from './GroupRow';
import { CopySheet } from './CopySheet';
import { fmtKcal } from './format';

export function MealCard({
  date, meal, mealName, mealNames, entries, onAddFood, onEditEntry,
}: {
  date: DateKey;
  meal: number;
  mealName: string;
  mealNames: string[];
  entries: LogEntry[];
  onAddFood: () => void;
  onEditEntry: (entry: LogEntry) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [savedMealName, setSavedMealName] = useState('');
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const loose = entries.filter((e) => !e.groupId);
  const [status, setStatus] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const kcal = entries.reduce((s, e) => s + e.nutrients.kcal, 0);

  const copyFromYesterday = async () => {
    setMenuOpen(false);
    const count = await copyMeal(addDays(date, -1), meal, date, meal);
    setStatus(count > 0 ? `Copied ${count} item${count === 1 ? '' : 's'}` : 'Nothing to copy');
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <Card className="relative">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{mealName}</h3>
        <div className="flex items-center gap-2">
          {entries.length > 0 && <span className="text-sm text-kcal">{fmtKcal(kcal)} kcal</span>}
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${mealName} options`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreVertical size={18} />
            </Button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-border bg-surface p-1 shadow-lg">
                <button
                  role="menuitem"
                  disabled={entries.length === 0}
                  onClick={() => {
                    setMenuOpen(false);
                    setCopyOpen(true);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-40"
                >
                  Copy to…
                </button>
                <button
                  role="menuitem"
                  onClick={copyFromYesterday}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
                >
                  Copy from yesterday
                </button>
                <button
                  role="menuitem"
                  disabled={entries.length === 0}
                  onClick={() => { setMenuOpen(false); setSavedMealName(mealName); setSaveOpen(true); }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-40"
                >
                  Save as meal
                </button>
                <button
                  role="menuitem"
                  disabled={entries.length === 0}
                  onClick={() => { setMenuOpen(false); setRecipeOpen(true); }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-40"
                >
                  Save as recipe
                </button>
                <button
                  role="menuitem"
                  disabled={loose.length < 2}
                  onClick={() => { setMenuOpen(false); setGroupName(mealName); setGroupOpen(true); }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 disabled:opacity-40"
                >
                  Group as one item
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {status && <div className="mb-2 text-xs text-muted">{status}</div>}

      {entries.length > 0 && (
        <div className="mb-1 divide-y divide-border">
          {toRows(entries).map((row) => row.kind === 'entry'
            ? <EntryRow key={row.entry.id} entry={row.entry} onClick={() => onEditEntry(row.entry)} />
            : <GroupRow key={row.id} entries={row.entries} onEditEntry={onEditEntry} />)}
        </div>
      )}

      <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted" onClick={onAddFood}>
        <Plus size={16} /> Add food
      </Button>

      <CopySheet
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title={`Copy ${mealName.toLowerCase()} to…`}
        defaultDate={addDays(date, 1)}
        onConfirm={(toDate, toMeal) => copyMeal(date, meal, toDate, toMeal)}
        mealNames={mealNames}
        defaultMeal={meal}
      />
      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title="Save meal">
        <div className="flex flex-col gap-4">
          <div><label className="mb-1.5 block text-sm text-muted" htmlFor={`saved-meal-${meal}`}>Name</label><Input id={`saved-meal-${meal}`} value={savedMealName} onChange={(e) => setSavedMealName(e.target.value)} autoFocus /></div>
          <Button variant="primary" disabled={!savedMealName.trim()} onClick={async () => { await saveLogEntriesAsMeal(savedMealName, entries); if (loose.length > 1) await groupLogEntries(loose.map((e) => e.id), savedMealName); setSaveOpen(false); setStatus('Saved meal'); setTimeout(() => setStatus(null), 3000); }}>Save meal</Button>
        </div>
      </Sheet>
      <Sheet open={groupOpen} onClose={() => setGroupOpen(false)} title="Group as one item">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">The {loose.length} separate items in {mealName.toLowerCase()} show as one row. Tap the row to see or edit them.</p>
          <div><label className="mb-1.5 block text-sm text-muted" htmlFor={`group-name-${meal}`}>Name</label><Input id={`group-name-${meal}`} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g. Protein mash" autoFocus /></div>
          <Button variant="primary" disabled={!groupName.trim()} onClick={async () => { await groupLogEntries(loose.map((e) => e.id), groupName); setGroupOpen(false); }}>Group</Button>
        </div>
      </Sheet>
      <Sheet open={recipeOpen} onClose={() => setRecipeOpen(false)} title="Save as recipe">
        {recipeOpen && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">For a batch you cooked: {entries.length === 1 ? 'the item' : `the ${entries.length} items`} in {mealName.toLowerCase()} {entries.length === 1 ? 'becomes' : 'become'} one recipe, and only the servings you ate stay in the log.</p>
            <SaveAsRecipeForm
              defaultName={mealName}
              ingredientGrams={entries.reduce((total, e) => total + e.grams, 0)}
              totalKcal={kcal}
              submitLabel={(portions) => (portions > 0 ? `Save and keep ${portions} serving${portions === 1 ? '' : 's'} in the log` : 'Save and remove from the log')}
              onSubmit={async ({ name, servings, yieldGrams, portions }) => {
                await saveLogEntriesAsRecipe(entries, { name, servings, yieldGrams }, { date, meal, portions });
                setRecipeOpen(false);
                setStatus(`Saved recipe "${name}"`);
                setTimeout(() => setStatus(null), 3000);
              }}
            />
          </div>
        )}
      </Sheet>
    </Card>
  );
}
