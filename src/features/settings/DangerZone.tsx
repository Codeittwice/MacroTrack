import { useState } from 'react';
import { Button, Sheet } from '@/components/ui';
import { Section } from './Section';
import { db } from '@/db/schema';

export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setBusy(true);
    setError(null);
    try {
      await db.delete();
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset data.');
      setBusy(false);
    }
  }

  return (
    <Section title="Danger zone">
      <p className="mb-3 text-sm text-muted">
        Permanently delete everything stored on this device: profile, targets, food log, weights, recipes and photos.
      </p>
      <Button variant="danger" onClick={() => setOpen(true)}>Reset all data</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Reset all data?">
        <p className="mb-4 text-sm text-muted">
          This permanently deletes everything on this device — your profile, targets, food log, weights, recipes and
          photos. This cannot be undone.
        </p>
        {error && <p className="mb-3 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        <div className="flex gap-3">
          <Button className="flex-1" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button className="flex-1" variant="danger" onClick={handleReset} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete everything'}
          </Button>
        </div>
      </Sheet>
    </Section>
  );
}
