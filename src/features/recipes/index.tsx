import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, Input, Label, NumberInput, PageHeader, Segmented, Sheet, SourceBadge } from '@/components/ui';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import type { FoodItem, Recipe, SavedMeal } from '@/db/types';
import { useCustomFoods } from '@/lib/foods/hooks';
import { searchFoods } from '@/lib/food-sources/search';
import { createRecipe, deleteRecipe, deleteSavedMeal, updateRecipe, updateSavedMeal } from '@/lib/recipes/actions';
import { scale, sum } from '@/lib/utils/nutrients';
import { fmtG, fmtKcal } from '@/features/addfood/format';

type View = 'recipes' | 'meals' | 'foods';
type Ingredient = { food: FoodItem; grams: number };

function RecipeBuilder({ open, onClose, recipe }: { open: boolean; onClose: () => void; recipe?: Recipe }) {
  const [name, setName] = useState('');
  const [yieldGrams, setYieldGrams] = useState<number | undefined>();
  const [servings, setServings] = useState<number | undefined>(1);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(recipe?.name ?? '');
    setYieldGrams(recipe?.yieldGrams);
    setServings(recipe?.servings ?? 1);
    setQuery('');
    setResults([]);
    setIngredients(recipe?.ingredients.map((item) => ({ food: item.food, grams: item.grams })) ?? []);
    setConfirmDelete(false);
  }, [open, recipe]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      searchFoods(query, { limit: 8 }).then((foods) => active && setResults(foods)).catch(() => active && setResults([]));
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, query]);

  const ingredientWeight = ingredients.reduce((total, ingredient) => total + ingredient.grams, 0);
  const totals = useMemo(() => sum(ingredients.map((ingredient) => scale(ingredient.food.per100, ingredient.grams))), [ingredients]);
  const canSave = name.trim() && ingredients.length > 0 && yieldGrams !== undefined && yieldGrams > 0 && servings !== undefined && servings > 0 && !saving;
  const close = () => onClose();

  return <Sheet open={open} onClose={close} title={recipe ? 'Edit recipe' : 'New recipe'} wide><div className="flex flex-col gap-4">
    <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Turkey pasta" autoFocus /></div>
    <div className="relative"><Label>Ingredients</Label><Search size={18} className="pointer-events-none absolute top-9 left-3 text-muted" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods to add" className="pl-10" />
      {results.length > 0 && <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">{results.map((food) => <button key={food.id} type="button" onClick={() => { setIngredients((items) => [...items, { food, grams: 100 }]); setQuery(''); setResults([]); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-surface-2"><span className="min-w-0 flex-1 truncate">{food.name}</span><SourceBadge source={food.source} /></button>)}</div>}
    </div>
    {ingredients.length > 0 && <div className="divide-y divide-border rounded-xl bg-surface-2 px-3">{ingredients.map((ingredient, index) => <div key={`${ingredient.food.id}-${index}`} className="flex items-center gap-2 py-2"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{ingredient.food.name}</div><div className="text-xs text-muted">{fmtKcal(scale(ingredient.food.per100, ingredient.grams).kcal)} kcal</div></div><NumberInput aria-label={`${ingredient.food.name} amount`} value={ingredient.grams} onValue={(grams) => setIngredients((items) => items.map((item, i) => i === index ? { ...item, grams: grams ?? 0 } : item))} suffix="g" className="w-28" /><button type="button" aria-label={`Remove ${ingredient.food.name}`} onClick={() => setIngredients((items) => items.filter((_, i) => i !== index))} className="rounded-lg p-2 text-muted hover:bg-surface"><Trash2 size={16} /></button></div>)}</div>}
    <div className="grid grid-cols-2 gap-3"><div><Label hint={`Ingredients: ${fmtG(ingredientWeight)} g`}>Cooked yield</Label><NumberInput aria-label="Cooked yield" value={yieldGrams} onValue={setYieldGrams} suffix="g" /></div><div><Label>Servings</Label><NumberInput aria-label="Recipe servings" value={servings} onValue={setServings} /></div></div>
    {ingredients.length > 0 && <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center text-sm"><div className="text-kcal">{fmtKcal(totals.kcal)}<div className="text-xs text-muted">kcal</div></div><div className="text-protein">{fmtG(totals.protein)}g<div className="text-xs text-muted">protein</div></div><div className="text-carbs">{fmtG(totals.carbs)}g<div className="text-xs text-muted">carbs</div></div><div className="text-fat">{fmtG(totals.fat)}g<div className="text-xs text-muted">fat</div></div></div>}
    <Button variant="primary" size="lg" disabled={!canSave} onClick={async () => { if (!canSave || yieldGrams === undefined || servings === undefined) return; setSaving(true); try { const input = { name, ingredients: ingredients.filter((item) => item.grams > 0), yieldGrams, servings }; if (recipe) await updateRecipe(recipe.id, input); else await createRecipe(input); close(); } finally { setSaving(false); } }}><Plus size={18} /> {recipe ? 'Save changes' : 'Save recipe'}</Button>
    {recipe && <Button variant="danger" disabled={saving} onClick={async () => { if (!confirmDelete) { setConfirmDelete(true); return; } setSaving(true); try { await deleteRecipe(recipe.id); close(); } finally { setSaving(false); } }}><Trash2 size={16} /> {confirmDelete ? 'Tap again to delete' : 'Delete recipe'}</Button>}
  </div></Sheet>;
}

function RecipeList({ recipes, onEdit }: { recipes: Recipe[] | undefined; onEdit: (recipe: Recipe) => void }) {
  if (recipes === undefined) return <div className="py-8 text-center text-sm text-muted">Loading...</div>;
  if (recipes.length === 0) return <EmptyState title="No recipes yet" body="Build a recipe from foods you already know and reuse it from Add Food." />;
  return <div className="flex flex-col gap-2">{recipes.map((recipe) => <Card key={recipe.id} className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="truncate font-medium">{recipe.name}</div><div className="text-sm text-muted">{recipe.ingredients.length} ingredients, {recipe.servings} servings</div></div><div className="text-right text-sm text-kcal">{fmtKcal(sum(recipe.ingredients.map((item) => scale(item.food.per100, item.grams))).kcal)}</div><Button variant="ghost" size="sm" aria-label={`Edit ${recipe.name}`} title={`Edit ${recipe.name}`} onClick={() => onEdit(recipe)}><Pencil size={16} /></Button></Card>)}</div>;
}

function SavedMealEditor({ meal, onClose }: { meal?: SavedMeal; onClose: () => void }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState<Ingredient[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!meal) return;
    setName(meal.name);
    setItems(meal.items.map((item) => ({ food: item.food, grams: item.grams })));
    setConfirmDelete(false);
  }, [meal]);

  const canSave = !!meal && !!name.trim() && items.length > 0 && items.every((item) => item.grams > 0) && !saving;
  const totals = useMemo(() => sum(items.map((item) => scale(item.food.per100, item.grams))), [items]);

  return <Sheet open={!!meal} onClose={onClose} title="Edit saved meal"><div className="flex flex-col gap-4">
    <div><Label>Name</Label><Input value={name} onChange={(event) => setName(event.target.value)} autoFocus /></div>
    <div className="divide-y divide-border rounded-xl bg-surface-2 px-3">{items.map((item, index) => <div key={`${item.food.id}-${index}`} className="flex items-center gap-2 py-2"><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{item.food.name}</div><div className="text-xs text-muted">{fmtKcal(scale(item.food.per100, item.grams).kcal)} kcal</div></div><NumberInput aria-label={`${item.food.name} amount`} value={item.grams} onValue={(grams) => setItems((current) => current.map((currentItem, currentIndex) => currentIndex === index ? { ...currentItem, grams: grams ?? 0 } : currentItem))} suffix="g" className="w-28" /><button type="button" aria-label={`Remove ${item.food.name}`} onClick={() => setItems((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="rounded-lg p-2 text-muted hover:bg-surface"><Trash2 size={16} /></button></div>)}</div>
    <div className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center text-sm"><div className="text-kcal">{fmtKcal(totals.kcal)}<div className="text-xs text-muted">kcal</div></div><div className="text-protein">{fmtG(totals.protein)}g<div className="text-xs text-muted">protein</div></div><div className="text-carbs">{fmtG(totals.carbs)}g<div className="text-xs text-muted">carbs</div></div><div className="text-fat">{fmtG(totals.fat)}g<div className="text-xs text-muted">fat</div></div></div>
    <Button variant="primary" size="lg" disabled={!canSave} onClick={async () => { if (!meal || !canSave) return; setSaving(true); try { await updateSavedMeal(meal.id, { name, items }); onClose(); } finally { setSaving(false); } }}>Save changes</Button>
    <Button variant="danger" disabled={saving} onClick={async () => { if (!meal) return; if (!confirmDelete) { setConfirmDelete(true); return; } setSaving(true); try { await deleteSavedMeal(meal.id); onClose(); } finally { setSaving(false); } }}><Trash2 size={16} /> {confirmDelete ? 'Tap again to delete' : 'Delete saved meal'}</Button>
  </div></Sheet>;
}

export default function RecipesPage() {
  const [view, setView] = useState<View>('recipes');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe>();
  const [editingMeal, setEditingMeal] = useState<SavedMeal>();
  const recipes = useLiveQuery(() => db.recipes.orderBy('updatedAt').reverse().toArray().then((rows) => rows.filter(alive)), []);
  const savedMeals = useLiveQuery(() => db.savedMeals.orderBy('updatedAt').reverse().toArray().then((rows) => rows.filter(alive)), []);
  const customFoods = useCustomFoods();

  return <div className="mx-auto max-w-3xl"><PageHeader title="Foods and recipes" right={<Button variant="primary" size="sm" onClick={() => setBuilderOpen(true)}><Plus size={16} /> New recipe</Button>} />
    <Segmented options={[{ value: 'recipes', label: 'Recipes' }, { value: 'meals', label: 'Saved meals' }, { value: 'foods', label: 'My foods' }]} value={view} onChange={setView} className="mb-4" />
    {view === 'recipes' && <RecipeList recipes={recipes} onEdit={(recipe) => { setEditingRecipe(recipe); setBuilderOpen(true); }} />}
    {view === 'meals' && (savedMeals === undefined ? <div className="py-8 text-center text-sm text-muted">Loading...</div> : savedMeals.length === 0 ? <EmptyState title="No saved meals yet" body="Saved meals will let you log a group of foods together." /> : <div className="flex flex-col gap-2">{savedMeals.map((meal) => <Card key={meal.id} className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="truncate font-medium">{meal.name}</div><div className="text-sm text-muted">{meal.items.length} foods</div></div><Button variant="ghost" size="sm" aria-label={`Edit ${meal.name}`} title={`Edit ${meal.name}`} onClick={() => setEditingMeal(meal)}><Pencil size={16} /></Button></Card>)}</div>)}
    {view === 'foods' && (customFoods === undefined ? <div className="py-8 text-center text-sm text-muted">Loading...</div> : customFoods.length === 0 ? <EmptyState title="No custom foods yet" body="Create one from Add Food when a product is missing." /> : <div className="flex flex-col gap-2">{customFoods.map((food) => <Card key={food.id} className="flex justify-between gap-3"><div className="min-w-0"><div className="truncate font-medium">{food.name}</div>{food.brand && <div className="text-sm text-muted">{food.brand}</div>}</div><div className="text-sm text-kcal">{fmtKcal(food.per100.kcal)} kcal / 100 g</div></Card>)}</div>)}
    <RecipeBuilder open={builderOpen} recipe={editingRecipe} onClose={() => { setBuilderOpen(false); setEditingRecipe(undefined); }} />
    <SavedMealEditor meal={editingMeal} onClose={() => setEditingMeal(undefined)} />
  </div>;
}
