import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, UtensilsCrossed } from 'lucide-react';
import { Card } from '@/components/ui';
import type { Settings } from '@/db/types';
import { parseTime } from '@/lib/native/reminders';

const isAfter = (time: string, now: Date) => {
  const t = parseTime(time);
  return !!t && now.getHours() * 60 + now.getMinutes() >= t.hour * 60 + t.minute;
};

/**
 * In-app counterparts of the weigh-in and food-log notifications, shown after their reminder time
 * until today's weight / food is logged. (Android also gets real notifications.)
 */
export function DailyPrompts({ settings, weighedToday, loggedToday }: { settings: Settings; weighedToday: boolean; loggedToday: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const weigh = settings.weighInReminderEnabled && !weighedToday && isAfter(settings.weighInReminderTime, now);
  const log = settings.logReminderEnabled && !loggedToday && isAfter(settings.logReminderTime, now);
  if (!weigh && !log) return null;
  return (
    <>
      {weigh && <Prompt to="/weight?log=1" icon={<Scale size={20} />} title="Weigh in today" body="A daily weigh-in keeps your trend and expenditure accurate." />}
      {log && <Prompt to="/log" icon={<UtensilsCrossed size={20} />} title="Nothing logged yet today" body="Log what you've eaten so today counts toward your estimate." />}
    </>
  );
}

function Prompt({ to, icon, title, body }: { to: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link to={to}>
      <Card className="flex items-center gap-3 border border-border hover:border-muted">
        <div className="rounded-xl p-2" style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>{icon}</div>
        <div className="min-w-0 flex-1"><div className="font-medium">{title}</div><div className="text-sm text-muted">{body}</div></div>
      </Card>
    </Link>
  );
}
