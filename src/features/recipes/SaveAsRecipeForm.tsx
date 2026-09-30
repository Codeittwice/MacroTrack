import { useState } from 'react';
import { BookmarkPlus } from 'lucide-react';
import { Button, Input, Label, NumberInput } from '@/components/ui';
import { fmtG, fmtKcal } from '@/features/addfood/format';

export interface SaveAsRecipeValues {
  name: string;
  servings: number;
  yieldGrams: number;
  /** Servings eaten now; 0 saves the recipe without logging. */
  portions: number;
}

/**
 * Name, servings and cooked weight for turning a batch of foods (a described meal prep, or a logged
 * meal) into a recipe, plus how many servings to log right now.
 */
export function SaveAsRecipeForm({ defaultName, ingredientGrams, totalKcal, submitLabel, onSubmit }: {
  defaultName: string;
  ingredientGrams: number;
  totalKcal: number;
  submitLabel: (portions: number) => string;
  onSubmit: (values: SaveAsRecipeValues) => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);
  const [servings, setServings] = useState<number | undefined>(4);
  const [yieldGrams, setYieldGrams] = useState<number | undefined>(Math.round(ingredientGrams));
  const [portions, setPortions] = useState<number | undefined>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const valid = !!name.trim() && !!servings && servings > 0 && !!yieldGrams && yieldGrams > 0 && portions !== undefined && portions >= 0;

  return (
    <div className="flex flex-col gap-3">
      <div><Label>Recipe name</Label><Input aria-label="Recipe name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken rice meal prep" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Servings in total</Label><NumberInput aria-label="Servings in total" value={servings} onValue={setServings} /></div>
        <div><Label hint="optional">Cooked weight</Label><NumberInput aria-label="Cooked weight" value={yieldGrams} onValue={setYieldGrams} suffix="g" /></div>
      </div>
      <div><Label hint="0 = just save">Servings you ate now</Label><NumberInput aria-label="Servings eaten now" value={portions} onValue={setPortions} /></div>
      {valid && (
        <p className="text-sm text-muted">
          1 serving ≈ {fmtG(yieldGrams! / servings!)} g · <span className="text-kcal">{fmtKcal(totalKcal / servings!)} kcal</span>
        </p>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button
        variant="primary"
        disabled={!valid || saving}
        onClick={async () => {
          if (!valid) return;
          setSaving(true);
          setError('');
          try {
            await onSubmit({ name: name.trim(), servings: servings!, yieldGrams: yieldGrams!, portions: portions! });
          } catch (e) {
            setError(e instanceof Error ? e.message : 'The recipe could not be saved.');
            setSaving(false);
          }
        }}
      >
        <BookmarkPlus size={18} /> {saving ? 'Saving…' : submitLabel(portions ?? 0)}
      </Button>
    </div>
  );
}
