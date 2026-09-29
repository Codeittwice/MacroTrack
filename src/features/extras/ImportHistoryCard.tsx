import { useState } from 'react';
import { Button, Card, Input, Segmented } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { importHistory, parseHistory, type ParsedHistory } from '@/lib/import/history';

/** Brings weight and food history over from MyFitnessPal, MacroFactor, Cronometer or a spreadsheet. */
export function ImportHistoryCard() {
  const settings = useSettings();
  const [parsed, setParsed] = useState<ParsedHistory | null>(null);
  const [fileName, setFileName] = useState('');
  const [source, setSource] = useState('MyFitnessPal');
  const [unit, setUnit] = useState<'kg' | 'lb'>(settings.weightUnit);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (file: File | undefined) => {
    setStatus(null);
    if (!file) return;
    setFileName(file.name);
    if (/macrofactor/i.test(file.name)) setSource('MacroFactor');
    else if (/cronometer/i.test(file.name)) setSource('Cronometer');
    const result = parseHistory(await file.text());
    setParsed(result);
    if (result.weightUnit) setUnit(result.weightUnit);
    if (!result.weights.length && !result.intake.length) setStatus('No dates with weights or calories were found. Export a CSV with a Date column.');
  };

  const dates = parsed ? [...parsed.weights.map((w) => w.date), ...parsed.intake.map((e) => e.date)].sort() : [];
  const days = parsed ? new Set(parsed.intake.map((e) => e.date)).size : 0;

  const run = async () => {
    if (!parsed) return;
    setBusy(true);
    try {
      const res = await importHistory(parsed, { source: source.trim() || 'Import', weightUnit: unit });
      setStatus(`Imported ${res.weights} weigh-ins and ${res.days} days of food. Your expenditure estimate now uses this history.`);
      setParsed(null);
    } catch {
      setStatus('The history could not be imported.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="mb-2 font-medium">Import from another app</div>
      <div className="mb-3 text-sm text-muted">Bring over weigh-ins and daily calories from MyFitnessPal, MacroFactor, Cronometer or a spreadsheet (CSV with a Date column). Importing the same file twice won't duplicate anything.</div>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-3 py-3 text-sm hover:border-muted">
        <input aria-label="History file" type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
        <span className="rounded-lg bg-surface-2 px-3 py-1.5 font-medium">Choose CSV</span>
        <span className="min-w-0 truncate text-muted">{fileName || 'No file selected'}</span>
      </label>
      {parsed && (parsed.weights.length > 0 || parsed.intake.length > 0) && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="text-sm">
            Found <b>{parsed.weights.length}</b> weigh-ins and <b>{days}</b> days of food{dates.length > 0 && <> from {dates[0]} to {dates[dates.length - 1]}</>}.
            {parsed.skippedRows > 0 && <span className="text-muted"> {parsed.skippedRows} rows without a usable date were skipped.</span>}
          </div>
          <div><div className="mb-1.5 text-sm text-muted">Source name</div><Input aria-label="Source name" value={source} onChange={(e) => setSource(e.target.value)} /></div>
          {parsed.weights.length > 0 && !parsed.weightUnit && (
            <div><div className="mb-1.5 text-sm text-muted">Weights in the file are in</div><Segmented options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} value={unit} onChange={setUnit} /></div>
          )}
          <Button variant="primary" disabled={busy} onClick={() => void run()}>{busy ? 'Importing…' : 'Import history'}</Button>
        </div>
      )}
      {status && <div role="status" className="mt-3 text-sm text-muted">{status}</div>}
    </Card>
  );
}
