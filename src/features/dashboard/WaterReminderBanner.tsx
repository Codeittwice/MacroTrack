import { useEffect, useState } from 'react';
import { Droplets } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import type { Settings } from '@/db/types';
import { addWater, useWater } from '@/lib/water/actions';
import { isWaterReminderDue } from '@/lib/reminders/water';
import { today } from '@/lib/utils/date';

export function WaterReminderBanner({ settings }: { settings: Settings }) {
  const date = today();
  const water = useWater(date);
  const [now, setNow] = useState(() => new Date());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (water === undefined || !isWaterReminderDue({ enabled: settings.waterReminderEnabled, reminderTime: settings.waterReminderTime, currentMl: water, goalMl: settings.waterGoalMl, now })) return null;
  return <Card className="flex items-center gap-3 border border-sky-500/30"><div className="rounded-xl bg-sky-500/15 p-2 text-sky-400"><Droplets size={20} /></div><div className="min-w-0 flex-1"><div className="font-medium">Water reminder</div><div className="text-sm text-muted">{water} of {settings.waterGoalMl} ml today</div></div><Button size="sm" disabled={saving} onClick={async () => { setSaving(true); try { await addWater(date, 250); } finally { setSaving(false); } }}>+250 ml</Button></Card>;
}
