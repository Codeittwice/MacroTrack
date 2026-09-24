import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Droplets, Plus, Ruler, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, Input, Label, NumberInput, PageHeader, ProgressBar, Sheet } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { addWater, setWater, useWater } from '@/lib/water/actions';
import { today } from '@/lib/utils/date';
import type { Measurement } from '@/db/types';
import { deleteMeasurement, MEASUREMENT_FIELDS, saveMeasurement, useMeasurements } from '@/lib/measurements/actions';

function WaterPage() {
  const settings = useSettings();
  const date = today();
  const water = useWater(date);
  const [draft, setDraft] = useState<number | undefined>(water);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(water), [water]);

  if (water === undefined) return <div className="py-10 text-center text-sm text-muted">Loading water...</div>;
  const update = async (next: () => Promise<unknown>) => { setSaving(true); try { await next(); } finally { setSaving(false); } };

  return <div className="mx-auto flex max-w-lg flex-col gap-4"><PageHeader title="Water" />
    <Card><div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-sky-500/15 p-3 text-sky-400"><Droplets size={24} /></div><div><div className="text-2xl font-semibold">{water} ml</div><div className="text-sm text-muted">of {settings.waterGoalMl} ml today</div></div></div><ProgressBar value={water} max={settings.waterGoalMl} color="var(--primary)" /></Card>
    <div className="grid grid-cols-3 gap-3">{[250, 500, 750].map((ml) => <Button key={ml} disabled={saving} onClick={() => void update(() => addWater(date, ml))}>+{ml} ml</Button>)}</div>
    <Card><div className="mb-2 font-medium">Daily total</div><div className="flex gap-3"><NumberInput aria-label="Water total" value={draft} onValue={setDraft} suffix="ml" className="flex-1" /><Button disabled={saving || draft === undefined} onClick={() => void update(() => setWater(date, draft ?? 0))}>Save</Button></div></Card>
  </div>;
}

function MeasurementSheet({ entry, open, onClose }: { entry?: Measurement; open: boolean; onClose: () => void }) {
  const [date, setDate] = useState(entry?.date ?? today());
  const [values, setValues] = useState<Record<string, number | undefined>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setDate(entry?.date ?? today()); setValues(entry?.values ?? {}); } }, [entry, open]);
  const valid = Object.values(values).some((value) => value !== undefined && value > 0);
  return <Sheet open={open} onClose={onClose} title={entry ? 'Edit measurements' : 'Log measurements'}><div className="flex flex-col gap-4"><div><Label>Date</Label><Input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value)} /></div>{MEASUREMENT_FIELDS.map((field) => <div key={field}><Label>{field[0].toUpperCase() + field.slice(1)}</Label><NumberInput aria-label={`${field} measurement`} value={values[field]} onValue={(value) => setValues((current) => ({ ...current, [field]: value }))} suffix="cm" /></div>)}<Button variant="primary" size="lg" disabled={!valid || saving} onClick={async () => { setSaving(true); try { await saveMeasurement(date, Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as Record<string, number>); onClose(); } finally { setSaving(false); } }}>Save measurements</Button></div></Sheet>;
}

function MeasurementsPage() {
  const measurements = useMeasurements();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Measurement>();
  if (measurements === undefined) return <div className="py-10 text-center text-sm text-muted">Loading measurements...</div>;
  const openNew = () => { setEditing(undefined); setOpen(true); };
  return <div className="mx-auto flex max-w-lg flex-col gap-4"><PageHeader title="Body measurements" right={<Button variant="primary" size="sm" onClick={openNew}><Plus size={16} /> Log</Button>} />{measurements.length === 0 ? <EmptyState icon={<Ruler size={32} />} title="No measurements yet" body="Track your waist, chest, and hips alongside your weight." action={<Button variant="primary" onClick={openNew}><Plus size={18} /> Log measurements</Button>} /> : <div className="flex flex-col gap-2">{measurements.map((entry) => <Card key={entry.id} className="flex items-center gap-3"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setEditing(entry); setOpen(true); }}><div className="font-medium">{entry.date}</div><div className="text-sm text-muted">{Object.entries(entry.values).map(([name, value]) => `${name} ${value} cm`).join(', ')}</div></button><button type="button" aria-label={`Delete measurements from ${entry.date}`} onClick={() => void deleteMeasurement(entry.id)} className="rounded-lg p-2 text-muted hover:bg-surface-2"><Trash2 size={16} /></button></Card>)}</div>}<MeasurementSheet entry={editing} open={open} onClose={() => setOpen(false)} /></div>;
}

export default function ExtrasPage() {
  const section = useParams()['*'];
  const navigate = useNavigate();
  if (section === 'water') return <WaterPage />;
  if (section === 'measurements') return <MeasurementsPage />;
  const title = section === 'measurements' ? 'Body measurements' : section === 'photos' ? 'Progress photos' : section === 'backup' ? 'Export and backup' : 'Extras';
  return <div className="mx-auto max-w-lg"><PageHeader title={title} right={section ? <Button variant="ghost" size="sm" onClick={() => navigate('/more')}>Back</Button> : undefined} /><EmptyState title="Coming in this Wave" body="This workflow is next in the Wave 4 build." /></div>;
}
