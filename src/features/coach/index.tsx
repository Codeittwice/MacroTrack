import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, RotateCcw } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Stat } from '@/components/ui';
import { useProfile, useSettings } from '@/app/hooks';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import { prepareCheckIn, saveCheckIn } from '@/lib/coach/actions';
import { today } from '@/lib/utils/date';
import { toDisplay } from '@/lib/weight/actions';

const confidenceColor = { low: 'var(--warning)', medium: 'var(--primary)', high: 'var(--protein)' };

function macroLabel(value: number, label: string) {
  return <span>{Math.round(value)}<span className="ml-0.5 text-xs text-muted">{label}</span></span>;
}

export default function CoachPage() {
  const profile = useProfile();
  const settings = useSettings();
  const date = today();
  const proposal = useLiveQuery(() => profile ? prepareCheckIn(profile, date) : undefined, [profile?.updatedAt, date]);
  const checkIn = useLiveQuery(() => db.checkins.where('date').equals(date).toArray().then((items) => items.find(alive) ?? null), [date]);
  const history = useLiveQuery(() => db.checkins.orderBy('date').reverse().toArray().then((items) => items.filter(alive).slice(0, 4)), []);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (profile === undefined) return <div className="py-10 text-center text-sm text-muted">Preparing your check-in...</div>;
  if (profile === null) return <EmptyState title="Finish onboarding first" body="Your Coach needs your goals and starting details." />;
  if (proposal === undefined || checkIn === undefined) return <div className="py-10 text-center text-sm text-muted">Preparing your check-in...</div>;

  const accept = async (accepted: boolean) => {
    setSaving(true);
    setStatus(null);
    try {
      await saveCheckIn(date, proposal, accepted);
      setStatus(accepted ? 'Targets updated for today.' : 'Check-in recorded without changing targets.');
    } finally {
      setSaving(false);
    }
  };

  const displayedWeight = toDisplay(proposal.trendWeightKg, settings.weightUnit);

  return <div className="mx-auto flex max-w-2xl flex-col gap-4"><PageHeader title="Coach" />
    <Card className="border border-primary/25 bg-primary/10"><div className="mb-4 flex items-start justify-between gap-3"><div><div className="font-semibold">Weekly check-in</div><div className="text-sm text-muted">{checkIn ? (checkIn.accepted ? 'Accepted today' : 'Reviewed today') : 'Review today\'s trend and targets'}</div></div><span className="rounded px-2 py-1 text-xs font-medium" style={{ color: confidenceColor[proposal.confidence], background: `${confidenceColor[proposal.confidence]}1f` }}>{proposal.confidence} confidence</span></div>
      <div className="grid grid-cols-3 gap-3"><Stat label="Trend weight" value={`${displayedWeight.toFixed(1)} ${settings.weightUnit}`} /><Stat label="Weekly rate" value={`${proposal.weeklyRateKg > 0 ? '+' : ''}${proposal.weeklyRateKg.toFixed(2)} kg`} /><Stat label="Expenditure" value={`${proposal.expenditure} kcal`} /></div>
      {proposal.staleDays > 0 && <div className="mt-4 text-sm text-warning">Your latest weigh-in is {proposal.staleDays} days old, so this proposal is less certain.</div>}
    </Card>

    <Card><div className="mb-3 font-semibold">Proposed daily targets</div><div className="grid grid-cols-4 gap-2 text-center"><div className="text-kcal">{macroLabel(proposal.proposed.kcal, 'kcal')}</div><div className="text-protein">{macroLabel(proposal.proposed.protein, 'P')}</div><div className="text-carbs">{macroLabel(proposal.proposed.carbs, 'C')}</div><div className="text-fat">{macroLabel(proposal.proposed.fat, 'F')}</div></div></Card>

    <div className="grid grid-cols-2 gap-3"><Button variant="primary" size="lg" disabled={saving} onClick={() => void accept(true)}><Check size={18} /> Apply targets</Button><Button variant="secondary" size="lg" disabled={saving} onClick={() => void accept(false)}><RotateCcw size={18} /> Keep current</Button></div>
    {status && <div role="status" className="text-sm text-muted">{status}</div>}

    {history && history.length > 0 && <section><h2 className="mb-2 text-sm font-medium text-muted">Recent check-ins</h2><div className="flex flex-col gap-2">{history.map((item) => <Card key={item.id} className="flex items-center justify-between gap-3 py-3"><div><div className="font-medium">{item.date}</div><div className="text-sm text-muted">{item.expenditure} kcal expenditure</div></div><div className={item.accepted ? 'text-sm text-primary' : 'text-sm text-muted'}>{item.accepted ? 'Applied' : 'Kept current'}</div></Card>)}</div></section>}
  </div>;
}
