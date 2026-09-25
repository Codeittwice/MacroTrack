import { useRef, useState } from 'react';
import { Camera, Sparkles, Trash2, X } from 'lucide-react';
import { Button, Input, NumberInput, SourceBadge } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import type { DateKey } from '@/db/types';
import { estimateMeal, groundEstimate, type GroundedEstimateItem, type MealImage } from '@/lib/ai';
import { prepareMealPhoto } from './mealPhoto';
import { addLogEntry } from '@/lib/log/actions';
import { fmtKcal } from './format';

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
    <div><label className="mb-1.5 block text-sm text-muted" htmlFor="meal-description">{photo ? 'Anything to add? (optional)' : 'Meal description'}</label><Input id="meal-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder={photo ? 'e.g. I only ate half' : 'e.g. 2 AH turkse broodjes with kipfilet and hummus'} autoFocus /></div>
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
    {items.length > 0 && <div className="flex flex-col gap-3"><div className="text-sm text-muted">Review the portions before adding them.</div><div className="divide-y divide-border rounded-xl bg-surface-2 px-3">{items.map((item) => <div key={item.key} className="flex items-center gap-2 py-2"><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5"><span className="truncate text-sm font-medium">{item.food.name}</span><SourceBadge source={item.food.source} /></div><div className="text-xs text-muted">{item.grounded ? 'Matched to food data' : `${Math.round(item.estimate.confidence * 100)}% confidence`} · {fmtKcal(item.food.per100.kcal * item.grams / 100)} kcal</div></div><NumberInput aria-label={`${item.food.name} amount`} value={item.grams} onValue={(grams) => setItems((current) => current.map((currentItem) => currentItem.key === item.key ? { ...currentItem, grams: grams ?? 0 } : currentItem))} suffix="g" className="w-28" /><button type="button" aria-label={`Remove ${item.food.name}`} onClick={() => setItems((current) => current.filter((currentItem) => currentItem.key !== item.key))} className="rounded-lg p-2 text-muted hover:bg-surface"><Trash2 size={16} /></button></div>)}</div><Button variant="primary" size="lg" disabled={logging || items.length === 0 || items.some((item) => item.grams <= 0)} onClick={() => void logItems()}><Sparkles size={18} /> {logging ? 'Adding...' : `Add ${items.length} item${items.length === 1 ? '' : 's'} to log`}</Button><Button variant="secondary" onClick={() => setItems([])}>Start over</Button></div>}
    {status && <div role="status" className="text-sm text-muted">{status}</div>}
  </div>;
}
