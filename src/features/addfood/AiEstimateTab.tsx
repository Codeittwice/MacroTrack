import { useRef, useState } from 'react';
import { BookmarkPlus, Camera, Languages, Mic, Sparkles, Square, Trash2, X } from 'lucide-react';
import { Button, Input, NumberInput, SourceBadge } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import type { DateKey } from '@/db/types';
import { estimateMeal, groundEstimate, type GroundedEstimateItem, type MealImage } from '@/lib/ai';
import { prepareMealPhoto } from './mealPhoto';
import { hasCyrillic, translateToEnglish } from '@/lib/ai';
import { resolveLang, speechMethod, startListening, type SpeechSession } from '@/lib/native/speech';
import { addLogEntry } from '@/lib/log/actions';
import { createRecipe, logRecipeServings } from '@/lib/recipes/actions';
import { SaveAsRecipeForm } from '@/features/recipes/SaveAsRecipeForm';
import { fmtKcal } from './format';
import { FoodName } from '@/components/FoodName';

type ReviewItem = GroundedEstimateItem & { key: string; grams: number };

export function AiEstimateTab({ date, meal, onLogged }: { date: DateKey; meal: number; onLogged: () => void }) {
  const settings = useSettings();
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [logging, setLogging] = useState(false);
  const [photo, setPhoto] = useState<{ image: MealImage; previewUrl: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const apiKey = settings.apiKeys[settings.aiProvider];
  const [listening, setListening] = useState<SpeechSession | null>(null);
  const [heard, setHeard] = useState('');
  const [original, setOriginal] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [asRecipe, setAsRecipe] = useState(false);
  const voice = speechMethod(settings.aiProvider, apiKey);

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
          const combined = description.trim() ? `${description.trim()} ${text}` : text;
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
    try {
      setPhoto(await prepareMealPhoto(file));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'That photo could not be read.');
    }
  };

  const estimate = async () => {
    setEstimating(true);
    setStatus(null);
    try {
      const result = await estimateMeal({ provider: settings.aiProvider, apiKey: apiKey ?? '', description, image: photo?.image });
      const grounded = await groundEstimate(result);
      setItems(grounded.map((item, index) => ({ ...item, key: `${item.food.id}-${index}`, grams: item.estimate.grams })));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The meal estimate could not be completed.');
    } finally {
      setEstimating(false);
    }
  };

  const logItems = async () => {
    if (!items.length) return;
    setLogging(true);
    try {
      await Promise.all(items.map((item) => addLogEntry({ date, meal, food: item.food, grams: item.grams, servingLabel: item.grounded ? undefined : 'AI estimate' })));
      onLogged();
    } catch {
      setStatus('The estimated foods could not be added to the log.');
      setLogging(false);
    }
  };

  return <div className="flex flex-col gap-4">
    <div><label className="mb-1.5 block text-sm text-muted" htmlFor="meal-description">{photo ? 'Anything to add? (optional)' : 'Meal description'}</label><Input id="meal-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={photo ? 'e.g. I only ate half' : 'e.g. 2 AH turkse broodjes with kipfilet and hummus'} autoFocus />
      {voice !== 'none' && (
        <Button variant={listening ? 'danger' : 'secondary'} className="mt-2 w-full" onClick={() => void toggleVoice()} aria-label={listening ? 'Stop listening' : 'Describe by voice'}>
          {listening ? <><Square size={16} /> Stop</> : <><Mic size={18} /> Describe by voice</>}
        </Button>
      )}
      {listening && <p role="status" className="mt-2 text-sm text-muted">{heard || 'Listening… say what you ate.'}</p>}
      {translating && <p role="status" className="mt-2 text-sm text-muted">Translating to English…</p>}
      {original && <p className="mt-2 text-xs text-muted">Translated from Bulgarian: {original}</p>}
      {!original && !translating && hasCyrillic(description) && (
        <Button size="sm" variant="ghost" className="mt-1" onClick={() => void translate(description)}><Languages size={16} /> Translate to English</Button>
      )}
    </div>
    {items.length === 0 && (photo ? (
      <div className="relative self-start">
        <img src={photo.previewUrl} alt="Meal photo to estimate" className="max-h-48 rounded-xl" />
        <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute top-2 right-2 rounded-full bg-bg/80 p-1.5 text-text"><X size={16} /></button>
      </div>
    ) : (
      <>
        <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Meal photo" onChange={(event) => { void choosePhoto(event.target.files?.[0]); event.target.value = ''; }} />
        <Button variant="secondary" onClick={() => fileInput.current?.click()}><Camera size={18} /> Take or choose a photo</Button>
      </>
    ))}
    {items.length === 0 && <Button variant="primary" disabled={(!description.trim() && !photo) || !apiKey || estimating} onClick={() => void estimate()}><Sparkles size={18} /> {estimating ? 'Estimating...' : 'Estimate meal'}</Button>}
    {!apiKey && <div role="status" className="text-sm text-muted">Add a {settings.aiProvider === 'claude' ? 'Claude' : settings.aiProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key in Settings to estimate meals.</div>}
    {items.length > 0 && <div className="flex flex-col gap-3"><div className="text-sm text-muted">Review the portions before adding them.</div><div className="divide-y divide-border rounded-xl bg-surface-2 px-3">{items.map((item) => <div key={item.key} className="flex items-center gap-2 py-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><FoodName item={item.food} className="truncate text-sm font-medium" /><SourceBadge source={item.food.source} /></div><div className="text-xs text-muted">{item.grounded ? 'Matched to food data' : `${Math.round(item.estimate.confidence * 100)}% confidence`} · {fmtKcal(item.food.per100.kcal * item.grams / 100)} kcal</div></div><NumberInput aria-label={`${item.food.name} amount`} value={item.grams} onValue={(grams) => setItems((current) => current.map((currentItem) => currentItem.key === item.key ? { ...currentItem, grams: grams ?? 0 } : currentItem))} suffix="g" className="w-28" /><button type="button" aria-label={`Remove ${item.food.name}`} onClick={() => setItems((current) => current.filter((currentItem) => currentItem.key !== item.key))} className="rounded-lg p-2 text-muted hover:bg-surface"><Trash2 size={16} /></button></div>)}</div><Button variant="primary" size="lg" disabled={logging || items.length === 0 || items.some((item) => item.grams <= 0)} onClick={() => void logItems()}><Sparkles size={18} /> {logging ? 'Adding...' : `Add ${items.length} item${items.length === 1 ? '' : 's'} to log`}</Button>{asRecipe ? (
      <div className="rounded-xl border border-border p-3">
        <div className="mb-2 font-medium">Save as recipe</div>
        <SaveAsRecipeForm
          defaultName={description.trim().slice(0, 60) || 'Meal prep'}
          ingredientGrams={items.reduce((total, item) => total + item.grams, 0)}
          totalKcal={items.reduce((total, item) => total + item.food.per100.kcal * item.grams / 100, 0)}
          submitLabel={(portions) => (portions > 0 ? `Save recipe and log ${portions} serving${portions === 1 ? '' : 's'}` : 'Save recipe')}
          onSubmit={async ({ name, servings, yieldGrams, portions }) => {
            const recipe = await createRecipe({ name, servings, yieldGrams, ingredients: items.filter((item) => item.grams > 0).map((item) => ({ food: item.food, grams: item.grams })) });
            if (portions > 0) await logRecipeServings(recipe, date, meal, portions);
            onLogged();
          }}
        />
      </div>
    ) : (
      <Button variant="secondary" onClick={() => setAsRecipe(true)}><BookmarkPlus size={18} /> Meal prep? Save as recipe</Button>
    )}<Button variant="secondary" onClick={() => { setItems([]); setAsRecipe(false); }}>Start over</Button></div>}
    {status && <div role="status" className="text-sm text-muted">{status}</div>}
  </div>;
}
