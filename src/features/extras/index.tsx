import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Droplets } from 'lucide-react';
import { Button, Card, EmptyState, NumberInput, PageHeader, ProgressBar } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { addWater, setWater, useWater } from '@/lib/water/actions';
import { today } from '@/lib/utils/date';

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

export default function ExtrasPage() {
  const section = useParams()['*'];
  const navigate = useNavigate();
  if (section === 'water') return <WaterPage />;
  const title = section === 'measurements' ? 'Body measurements' : section === 'photos' ? 'Progress photos' : section === 'backup' ? 'Export and backup' : 'Extras';
  return <div className="mx-auto max-w-lg"><PageHeader title={title} right={section ? <Button variant="ghost" size="sm" onClick={() => navigate('/more')}>Back</Button> : undefined} /><EmptyState title="Coming in this Wave" body="This workflow is next in the Wave 4 build." /></div>;
}
