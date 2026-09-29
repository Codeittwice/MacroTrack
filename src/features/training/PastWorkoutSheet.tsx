import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Label, NumberInput, Sheet } from '@/components/ui';
import { logPastWorkout, useTemplates } from '@/lib/training/actions';
import { addDays, today } from '@/lib/utils/date';

/** Adds a workout that already happened on a chosen day, then opens it in the editor. */
export function PastWorkoutSheet({ open, date: initialDate, onClose }: { open: boolean; date?: string; onClose: () => void }) {
  const nav = useNavigate();
  const templates = useTemplates();
  const [date, setDate] = useState(initialDate ?? addDays(today(), -1));
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState<number | undefined>(60);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (open) { setDate(initialDate ?? addDays(today(), -1)); setError(''); } }, [open, initialDate]);

  const save = async () => {
    try {
      const w = await logPastWorkout({ date, time, durationMin: duration ?? 60, name, template: templates?.find((t) => t.id === templateId) });
      onClose();
      nav(`/training/workout/${w.id}?edit=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Log a past workout">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" aria-label="Past workout date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Start time</Label><Input type="time" aria-label="Past workout start time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        </div>
        <div><Label>Duration</Label><NumberInput aria-label="Past workout duration" value={duration} onValue={setDuration} suffix="min" /></div>
        <div><Label hint="optional">Name</Label><Input aria-label="Past workout name" value={name} placeholder="e.g. Push day" onChange={(e) => setName(e.target.value)} /></div>
        {templates && templates.length > 0 && (
          <div>
            <Label hint="optional">Start from template</Label>
            <select aria-label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-surface-2 px-3 text-sm">
              <option value="">No template</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button variant="primary" size="lg" disabled={!date || !time || date > today()} onClick={() => void save()}>Add exercises</Button>
      </div>
    </Sheet>
  );
}
