import { useState } from 'react';
import { Button, Sheet } from '@/components/ui';
import type { DateKey, DayNote } from '@/db/types';
import { addDays } from '@/lib/utils/date';
import { copyDay, setDayIncomplete, setDayNote } from '@/lib/log/actions';
import { CopySheet } from './CopySheet';

export function DayMenu({
  open, onClose, date, note,
}: {
  open: boolean;
  onClose: () => void;
  date: DateKey;
  note: DayNote | undefined;
}) {
  const [copyOpen, setCopyOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(note?.text ?? '');

  const openNote = () => {
    setNoteText(note?.text ?? '');
    setNoteOpen(true);
  };

  return (
    <>
      <Sheet open={open && !copyOpen && !noteOpen} onClose={onClose} title="Day options">
        <div className="flex flex-col gap-1">
          <button
            className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-2"
            onClick={() => setCopyOpen(true)}
          >
            Copy day from…
          </button>

          <label className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={note?.incomplete ?? false}
              onChange={(e) => setDayIncomplete(date, e.target.checked)}
            />
            <span>
              <span className="block">Mark day incomplete</span>
              <span className="block text-xs text-muted">
                Incomplete days are excluded from the expenditure estimate, so a partly logged day doesn&apos;t skew your TDEE.
              </span>
            </span>
          </label>

          <button
            className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-2"
            onClick={openNote}
          >
            Day note{note?.text ? ' (added)' : ''}
          </button>
        </div>
      </Sheet>

      <CopySheet
        open={copyOpen}
        onClose={() => setCopyOpen(false)}
        title="Copy day from…"
        defaultDate={addDays(date, -1)}
        onConfirm={(fromDate) => copyDay(fromDate, date)}
      />

      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title="Day note">
        <div className="flex flex-col gap-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border bg-surface-2 p-3 outline-none focus:border-primary"
            placeholder="Add a note for this day…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={async () => {
                await setDayNote(date, noteText);
                setNoteOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
