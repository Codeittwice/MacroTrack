import { useEffect, useRef, useState } from 'react';
import { BookmarkPlus, Camera, Check, ChefHat, Languages, Loader2, Mic, Pencil, Sparkles, Square, Trash2, X } from 'lucide-react';
import { Button, Input, Label, NumberInput, SourceBadge, Textarea } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import type { DateKey, FoodItem, Nutrients } from '@/db/types';
import { estimateMeal, groundEstimate, hasCyrillic, translateToEnglish, type GroundedEstimateItem, type MealImage } from '@/lib/ai';
import { prepareMealPhoto } from './mealPhoto';
import { resolveLang, speechMethod, startListening, type SpeechSession } from '@/lib/native/speech';
import { addLogEntry } from '@/lib/log/actions';
import { createRecipe, logRecipeServings } from '@/lib/recipes/actions';
import { createBatch, logFromBatch } from '@/lib/batches/actions';
import { uuid } from '@/lib/utils/id';
import { fmtG, fmtKcal } from './format';
import { FoodName } from '@/components/FoodName';

type ReviewItem = GroundedEstimateItem & { key: string; grams: number };
type Step = 'idle' | 'thinking' | 'matching' | 'done';
type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat';

const MACROS: { key: MacroKey; label: string; color: string; unit: string }[] = [
  { key: 'kcal', label: 'kcal', color: 'var(--kcal)', unit: '' },
  { key: 'protein', label: 'Protein', color: 'var(--protein)', unit: 'g' },
  { key: 'carbs', label: 'Carbs', color: 'var(--carbs)', unit: 'g' },
  { key: 'fat', label: 'Fat', color: 'var(--fat)', unit: 'g' },
];

const itemTotal = (item: ReviewItem, key: MacroKey) => item.food.per100[key] * item.grams / 100;
const sumOf = (items: ReviewItem[], key: MacroKey) => items.reduce((t, item) => t + itemTotal(item, key), 0);

/** Overriding an item's macros rewrites its per-100 values; an edited food is the user's own estimate. */
function withMacros(food: FoodItem, grams: number, totals: Record<MacroKey, number>): FoodItem {
  const f = grams > 0 ? 100 / grams : 0;
  const per100: Nutrients = { ...food.per100, kcal: totals.kcal * f, protein: totals.protein * f, carbs: totals.carbs * f, fat: totals.fat * f };
  return { ...food, id: food.id.startsWith('ai:') ? food.id : `ai:${uuid()}`, source: 'ai', per100 };
}

function MacroEditor({ item, onSave, onCancel }: { item: ReviewItem; onSave: (food: FoodItem) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Record<MacroKey, number | undefined>>(() => ({
    kcal: Math.round(itemTotal(item, 'kcal')), protein: Math.round(itemTotal(item, 'protein') * 10) / 10,
    carbs: Math.round(itemTotal(item, 'carbs') * 10) / 10, fat: Math.round(itemTotal(item, 'fat') * 10) / 10,
  }));
  const valid = MACROS.every(({ key }) => values[key] !== undefined && values[key]! >= 0);
  return (
    <div className="mb-2 rounded-xl bg-surface p-3">
      <div className="mb-2 text-xs text-muted">Macros for {fmtG(item.grams)} g</div>
      <div className="grid grid-cols-4 gap-2">
        {MACROS.map(({ key, label }) => (
          <div key={key}><div className="mb-1 text-[11px] text-muted">{label}</div><NumberInput aria-label={`${item.food.name} ${label}`} value={values[key]} onValue={(v) => setValues((cur) => ({ ...cur, [key]: v }))} /></div>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={!valid} onClick={() => onSave(withMacros(item.food, item.grams, values as Record<MacroKey, number>))}><Check size={14} /> Save</Button>
      </div>
    </div>
  );
}

function Totals({ items, portions }: { items: ReviewItem[]; portions: number }) {
  const per = portions > 1 ? portions : 1;
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="mb-2 flex items-baseline justify-between text-xs text-muted">
        <span>{portions > 1 ? 'Per portion' : 'Total'}</span>
        {portions > 1 && <span>Whole batch: {fmtKcal(sumOf(items, 'kcal'))} kcal · {fmtG(items.reduce((t, i) => t + i.grams, 0))} g raw</span>}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {MACROS.map(({ key, label, color, unit }) => (
          <div key={key}>
            <div className="text-lg font-semibold" style={{ color }}>{key === 'kcal' ? fmtKcal(sumOf(items, key) / per) : fmtG(sumOf(items, key) / per)}{unit}</div>
            <div className="text-[11px] text-muted">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Describe a meal (typed, spoken or photographed) and let the AI list its foods. In `photo` mode the
 * camera is the main input. A description of a cooked batch ("serves 4") becomes a meal prep: the
 * whole pot is saved as a recipe plus a batch, you log what you ate, and the rest shows as leftovers.
 */
export function AiEstimateTab({ date, meal, onLogged, mode = 'describe' }: { date: DateKey; meal: number; onLogged: () => void; mode?: 'describe' | 'photo' }) {
  const settings = useSettings();
  const [description, setDescription] = useState('');
  const descriptionRef = useRef('');
  descriptionRef.current = description;
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [logging, setLogging] = useState(false);
  const [photo, setPhoto] = useState<{ image: MealImage; previewUrl: string } | null>(null);
  const [reading, setReading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const apiKey = settings.apiKeys[settings.aiProvider];
  const [listening, setListening] = useState<SpeechSession | null>(null);
  const [heard, setHeard] = useState('');
  const [original, setOriginal] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [dishName, setDishName] = useState('');
  const [portions, setPortions] = useState<number | undefined>(1);
  const [cookedGrams, setCookedGrams] = useState<number | undefined>();
  const [eatNow, setEatNow] = useState<number | undefined>(1);
  const voice = speechMethod(settings.aiProvider, apiKey);
  const isBatch = (portions ?? 1) > 1;

  // Closing the sheet while listening must release the microphone.
  const sessionRef = useRef<SpeechSession | null>(null);
  sessionRef.current = listening;
  useEffect(() => () => sessionRef.current?.stop(), []);

  const translate = async (text: string) => {
    if (!apiKey) { setStatus('Add an API key in Settings to translate Bulgarian.'); return; }
    setTranslating(true);
    try {
      const english = await translateToEnglish(text, settings.aiProvider, apiKey);
      setOriginal(text);
      setDescription(english);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The description could not be translated.');
    } finally {
      setTranslating(false);
    }
  };

  const toggleVoice = async () => {
    if (listening) { listening.stop(); return; }
    setStatus(null);
    setOriginal(null);
    try {
      const session = await startListening({
        lang: resolveLang(settings.voiceLanguage ?? 'auto'),
        provider: settings.aiProvider,
        apiKey,
        onPartial: setHeard,
        onFinal: (text) => {
          setListening(null);
          setHeard('');
          if (!text) { setStatus("Didn't catch that. Try again a little closer to the microphone."); return; }
          // Append to what is in the box now, not what was there when listening started.
          const current = descriptionRef.current.trim();
          const combined = current ? `${current} ${text}` : text;
          if (hasCyrillic(combined)) void translate(combined);
          else setDescription(combined);
        },
        onError: (message) => { setListening(null); setHeard(''); setStatus(message); },
      });
      setListening(session);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Voice input could not start.');
    }
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    setStatus(null);
    setReading(true);
    try {
      setPhoto(await prepareMealPhoto(file));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'That photo could not be read.');
    } finally {
      setReading(false);
    }
  };

  const estimate = async () => {
    setStep('thinking');
    setStatus(null);
    try {
      const result = await estimateMeal({ provider: settings.aiProvider, apiKey: apiKey ?? '', description, image: photo?.image });
      setStep('matching');
      const grounded = await groundEstimate(result);
      setItems(grounded.map((item, index) => ({ ...item, key: `${item.food.id}-${index}`, grams: item.estimate.grams })));
      setDishName(result.dishName ?? description.trim().split(/[.,\n]/)[0].slice(0, 60));
      setPortions(result.portions ? Math.round(result.portions * 2) / 2 : 1);
      setCookedGrams(result.cookedGrams ? Math.round(result.cookedGrams) : undefined);
      setEatNow(1);
      setStep('done');
    } catch (error) {
      setStep('idle');
      setStatus(error instanceof Error ? error.message : 'The meal estimate could not be completed.');
    }
  };

  const ingredients = () => items.filter((item) => item.grams > 0).map((item) => ({ food: item.food, grams: item.grams }));
  const rawGrams = items.reduce((t, item) => t + item.grams, 0);
  const name = dishName.trim() || 'Meal';

  const run = async (action: () => Promise<void>, failure: string) => {
    setLogging(true);
    setStatus(null);
    try {
      await action();
      onLogged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : failure);
      setLogging(false);
    }
  };

  /** One meal: logged as a named group so it shows as a single tidy row. */
  const logMeal = () => run(async () => {
    const valid = items.filter((item) => item.grams > 0);
    const groupId = valid.length > 1 ? uuid() : undefined;
    await Promise.all(valid.map((item) => addLogEntry({ date, meal, food: item.food, grams: item.grams, servingLabel: item.grounded ? undefined : 'AI estimate', groupId, groupName: groupId ? name : undefined })));
  }, 'The estimated foods could not be added to the log.');

  const saveMealPrep = () => run(async () => {
    const total = portions!;
    const yieldGrams = cookedGrams && cookedGrams > 0 ? cookedGrams : rawGrams;
    const recipe = await createRecipe({ name, servings: total, yieldGrams, ingredients: ingredients() });
    const batch = await createBatch({ recipe, portions: total, yieldGrams, cookedOn: date });
    if (eatNow && eatNow > 0) await logFromBatch(batch, date, meal, { portions: eatNow });
  }, 'The meal prep could not be saved.');

  const saveRecipe = () => run(async () => {
    const recipe = await createRecipe({ name, servings: portions ?? 1, yieldGrams: cookedGrams && cookedGrams > 0 ? cookedGrams : rawGrams, ingredients: ingredients() });
    if (!isBatch) await logRecipeServings(recipe, date, meal, 1);
  }, 'The recipe could not be saved.');

  const busy = step === 'thinking' || step === 'matching';
  const hasInput = !!description.trim() || !!photo;

  const photoPicker = (
    <>
      <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Meal photo" onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = ''; }} />
      {photo ? (
        <div className="relative self-start">
          <img src={photo.previewUrl} alt="Meal photo to estimate" className="max-h-56 rounded-xl" />
          <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-bg/85 px-2 py-0.5 text-xs text-success"><Check size={12} /> Photo ready</span>
          <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute top-2 right-2 rounded-full bg-bg/80 p-1.5 text-text"><X size={16} /></button>
        </div>
      ) : mode === 'photo' ? (
        <button type="button" onClick={() => fileInput.current?.click()} className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted hover:border-primary hover:text-text">
          {reading ? <Loader2 size={32} className="animate-spin" /> : <Camera size={32} />}
          <span className="text-sm">{reading ? 'Reading photo…' : 'Take or choose a photo'}</span>
        </button>
      ) : (
        <Button variant="secondary" onClick={() => fileInput.current?.click()}>{reading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />} Take or choose a photo</Button>
      )}
    </>
  );

  if (step === 'done' && items.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <div><Label>Name</Label><Input aria-label="Meal name" value={dishName} onChange={(e) => setDishName(e.target.value)} placeholder="e.g. Protein mash" /></div>
        <div className="flex items-center gap-2 text-sm text-success"><Check size={16} /> Found {items.length} food{items.length === 1 ? '' : 's'}. Check the amounts, tap <Pencil size={12} className="inline" /> to fix macros.</div>
        <div className="divide-y divide-border rounded-xl bg-surface-2 px-3">
          {items.map((item) => (
            <div key={item.key} className="py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5"><FoodName item={item.food} className="truncate text-sm font-medium" /><SourceBadge source={item.food.source} /></div>
                  <div className="text-xs text-muted">
                    <span className="text-kcal">{fmtKcal(itemTotal(item, 'kcal'))} kcal</span> · P {fmtG(itemTotal(item, 'protein'))} · C {fmtG(itemTotal(item, 'carbs'))} · F {fmtG(itemTotal(item, 'fat'))}
                    {!item.grounded && ` · ${Math.round(item.estimate.confidence * 100)}% sure`}
                  </div>
                </div>
                <NumberInput aria-label={`${item.food.name} amount`} value={item.grams} onValue={(grams) => setItems((current) => current.map((c) => c.key === item.key ? { ...c, grams: grams ?? 0 } : c))} suffix="g" className="w-24" />
                <button type="button" aria-label={`Edit macros of ${item.food.name}`} onClick={() => setEditing(editing === item.key ? null : item.key)} className="rounded-lg p-2 text-muted hover:bg-surface"><Pencil size={15} /></button>
                <button type="button" aria-label={`Remove ${item.food.name}`} onClick={() => setItems((current) => current.filter((c) => c.key !== item.key))} className="rounded-lg p-2 text-muted hover:bg-surface"><Trash2 size={15} /></button>
              </div>
              {editing === item.key && (
                <MacroEditor item={item} onCancel={() => setEditing(null)} onSave={(food) => { setItems((current) => current.map((c) => c.key === item.key ? { ...c, food, grounded: false } : c)); setEditing(null); }} />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><Label hint="whole batch">Portions it makes</Label><NumberInput aria-label="Portions it makes" value={portions} onValue={setPortions} /></div>
          {isBatch && <div><Label hint="optional">Cooked weight</Label><NumberInput aria-label="Cooked weight" value={cookedGrams} onValue={setCookedGrams} placeholder={String(Math.round(rawGrams))} suffix="g" /></div>}
        </div>
        <Totals items={items} portions={portions ?? 1} />

        {isBatch ? (
          <>
            <div><Label hint="0 = just save">Portions you ate now</Label><NumberInput aria-label="Portions eaten now" value={eatNow} onValue={setEatNow} /></div>
            {eatNow !== undefined && portions && eatNow <= portions && (
              <p className="text-sm text-muted">{portions - eatNow} of {portions} portions stay as leftovers, one tap away under Add food.</p>
            )}
            <Button variant="primary" size="lg" disabled={logging || !portions || eatNow === undefined || eatNow < 0 || eatNow > portions} onClick={() => void saveMealPrep()}>
              <ChefHat size={18} /> {logging ? 'Saving…' : eatNow ? `Save meal prep and log ${eatNow} portion${eatNow === 1 ? '' : 's'}` : 'Save meal prep'}
            </Button>
            <Button variant="secondary" disabled={logging} onClick={() => void saveRecipe()}><BookmarkPlus size={18} /> Save as recipe only</Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="lg" disabled={logging || items.length === 0 || items.some((item) => item.grams <= 0)} onClick={() => void logMeal()}>
              <Sparkles size={18} /> {logging ? 'Adding…' : `Add ${name === 'Meal' ? 'meal' : `"${name}"`} to log`}
            </Button>
            <Button variant="secondary" disabled={logging} onClick={() => void saveRecipe()}><BookmarkPlus size={18} /> Save as recipe and log it</Button>
          </>
        )}
        <Button variant="ghost" onClick={() => { setItems([]); setStep('idle'); }}>Start over</Button>
        {status && <div role="status" className="text-sm text-danger">{status}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {mode === 'photo' && photoPicker}
      <div>
        <label className="mb-1.5 block text-sm text-muted" htmlFor="meal-description">{photo || mode === 'photo' ? 'Anything to add? (optional)' : 'Meal description'}</label>
        <Textarea
          id="meal-description"
          rows={mode === 'photo' ? 2 : 5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={photo || mode === 'photo' ? 'e.g. I only ate half' : 'What did you eat or cook? e.g. "Protein mash: 1 kg potatoes, 500 g skyr, 4 eggs, 30 g butter. Makes 4 portions, I ate 1."'}
          autoFocus={mode === 'describe'}
        />
        {voice !== 'none' && (
          <Button variant={listening ? 'danger' : 'secondary'} className="mt-2 w-full" onClick={() => void toggleVoice()} aria-label={listening ? 'Stop listening' : 'Describe by voice'}>
            {listening ? <><Square size={16} /> Stop</> : <><Mic size={18} /> Describe by voice</>}
          </Button>
        )}
        {listening && (
          <p role="status" className="mt-2 flex items-start gap-2 text-sm text-muted">
            <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-danger" />
            <span>{heard || 'Listening… take your time, pauses are fine. Tap Stop when you are done.'}</span>
          </p>
        )}
        {translating && <p role="status" className="mt-2 text-sm text-muted">Translating to English…</p>}
        {original && <p className="mt-2 text-xs text-muted">Translated from Bulgarian: {original}</p>}
        {!original && !translating && hasCyrillic(description) && (
          <Button size="sm" variant="ghost" className="mt-1" onClick={() => void translate(description)}><Languages size={16} /> Translate to English</Button>
        )}
      </div>
      {mode === 'describe' && photoPicker}
      <Button variant="primary" disabled={!hasInput || !apiKey || busy || !!listening} onClick={() => void estimate()}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} {busy ? 'Estimating…' : 'Estimate meal'}
      </Button>
      {busy && (
        <ol role="status" aria-label="Estimate progress" className="flex flex-col gap-1 text-sm">
          <li className={step === 'thinking' ? 'text-text' : 'text-success'}>{step === 'thinking' ? '…' : '✓'} {photo ? 'Recognising the foods in your photo' : 'Reading your description'}</li>
          <li className={step === 'matching' ? 'text-text' : 'text-muted'}>{step === 'matching' ? '…' : '○'} Matching to food data (NEVO, Open Food Facts)</li>
        </ol>
      )}
      {!apiKey && <div role="status" className="text-sm text-muted">Add a {settings.aiProvider === 'claude' ? 'Claude' : settings.aiProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key in Settings to estimate meals.</div>}
      {status && <div role="status" className="text-sm text-muted">{status}</div>}
    </div>
  );
}
