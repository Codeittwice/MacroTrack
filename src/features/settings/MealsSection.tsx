import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { Section } from './Section';
import { useSettings } from '@/app/hooks';
import { updateSettings } from '@/db/repo';
import { addMeal, moveMeal, removeMeal, renameMeal, sanitizeMealNames } from './helpers';

export function MealsSection() {
  const settings = useSettings();
  const names = settings.mealNames;

  function commit(next: string[]) {
    const clean = sanitizeMealNames(next);
    if (clean) updateSettings({ mealNames: clean });
  }

  return (
    <Section title="Meals">
      <div className="space-y-2">
        {names.map((name, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={name} onChange={(e) => updateSettings({ mealNames: renameMeal(names, i, e.target.value) })} onBlur={() => commit(names)} />
            <button
              type="button"
              className="rounded-lg p-2 text-muted hover:bg-surface-2 disabled:opacity-30"
              disabled={i === 0}
              onClick={() => commit(moveMeal(names, i, -1))}
              aria-label="Move up"
            >
              <ChevronUp size={18} />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-muted hover:bg-surface-2 disabled:opacity-30"
              disabled={i === names.length - 1}
              onClick={() => commit(moveMeal(names, i, 1))}
              aria-label="Move down"
            >
              <ChevronDown size={18} />
            </button>
            <button
              type="button"
              className="rounded-lg p-2 text-muted hover:bg-surface-2 disabled:opacity-30"
              disabled={names.length <= 1}
              onClick={() => commit(removeMeal(names, i))}
              aria-label="Remove meal"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
      <Button className="mt-3" onClick={() => commit(addMeal(names))}>
        <Plus size={16} /> Add meal
      </Button>
      <p className="mt-3 text-xs text-muted">
        Log entries reference meals by their position in this list. Reordering or removing a meal changes which meal
        existing entries appear under — a removed meal's entries fall back to the last meal.
      </p>
    </Section>
  );
}
