import { isNativeApp } from '@/lib/native/platform';
import { saveTextFile } from '@/lib/native/saveFile';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Droplets, Image, Plus, Ruler, Trash2 } from 'lucide-react';
import { Button, Card, EmptyState, Input, Label, NumberInput, PageHeader, ProgressBar, Sheet } from '@/components/ui';
import { useSettings } from '@/app/hooks';
import { addWater, setWater, useWater } from '@/lib/water/actions';
import { today } from '@/lib/utils/date';
import type { Measurement, ProgressPhoto } from '@/db/types';
import { deleteMeasurement, MEASUREMENT_FIELDS, saveMeasurement, useMeasurements } from '@/lib/measurements/actions';
import { deletePhoto, savePhoto, usePhotos } from '@/lib/photos/actions';
import { backupFileName, createBackup, parseBackup, restoreBackup } from '@/lib/backup/actions';

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

function PhotoPreview({ photo }: { photo: ProgressPhoto }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => { const next = URL.createObjectURL(photo.blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [photo.blob]);
  return url ? <img src={url} alt={`${photo.pose ?? 'Progress'} photo from ${photo.date}`} className="aspect-[3/4] w-full rounded-xl object-cover" /> : <div className="aspect-[3/4] animate-pulse rounded-xl bg-surface-2" />;
}

function PhotosPage() {
  const photos = usePhotos();
  const [file, setFile] = useState<File>();
  const [pose, setPose] = useState<ProgressPhoto['pose']>('front');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string>();
  if (photos === undefined) return <div className="py-10 text-center text-sm text-muted">Loading photos...</div>;
  const upload = async () => { if (!file) return; setSaving(true); setError(null); try { await savePhoto({ date: today(), blob: file, pose }); setFile(undefined); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save photo.'); } finally { setSaving(false); } };
  return <div className="mx-auto flex max-w-lg flex-col gap-4"><PageHeader title="Progress photos" /><Card><div className="mb-3 font-medium">Add photo</div><div className="flex flex-col gap-3"><input aria-label="Progress photo" type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0])} /><select aria-label="Photo pose" value={pose} onChange={(event) => setPose(event.target.value as ProgressPhoto['pose'])} className="h-11 rounded-xl border border-border bg-surface-2 px-3"><option value="front">Front</option><option value="side">Side</option><option value="back">Back</option></select><Button variant="primary" disabled={!file || saving} onClick={() => void upload()}><Plus size={18} /> {saving ? 'Saving...' : 'Save photo'}</Button></div>{error && <div role="status" className="mt-3 text-sm text-danger">{error}</div>}</Card>{photos.length === 0 ? <EmptyState icon={<Image size={32} />} title="No progress photos yet" body="Keep a private visual record alongside your measurements." /> : <div className="grid grid-cols-2 gap-3">{photos.map((photo) => <Card key={photo.id} className="p-2"><PhotoPreview photo={photo} /><div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-muted">{photo.date}, {photo.pose ?? 'front'}</span><button type="button" aria-label={`Delete photo from ${photo.date}`} onClick={() => { if (confirmDelete === photo.id) void deletePhoto(photo.id); else setConfirmDelete(photo.id); }} className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><Trash2 size={16} /></button></div>{confirmDelete === photo.id && <div className="mt-1 text-xs text-danger">Tap delete again</div>}</Card>)}</div>}</div>;
}

function BackupPage() {
  const [file, setFile] = useState<File>();
  const [status, setStatus] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [busy, setBusy] = useState(false);
  const exportData = async () => { setBusy(true); try { const backup = await createBackup(); const how = await saveTextFile(backupFileName(), JSON.stringify(backup, null, 2)); setStatus(how === 'shared' ? 'Backup ready. Choose where to save it.' : 'Backup downloaded.'); } catch { setStatus('The backup could not be saved.'); } finally { setBusy(false); } };
  const importData = async () => { if (!file) return; if (!confirmRestore) { setConfirmRestore(true); return; } setBusy(true); try { await restoreBackup(parseBackup(await file.text())); setStatus('Backup restored.'); setConfirmRestore(false); } catch (reason) { setStatus(reason instanceof Error ? reason.message : 'Could not restore this backup.'); setConfirmRestore(false); } finally { setBusy(false); } };
  return <div className="mx-auto flex max-w-lg flex-col gap-4"><PageHeader title="Export and backup" /><Card><div className="mb-2 font-medium">Export backup</div><div className="mb-3 text-sm text-muted">Your food, weight, targets, check-ins, and settings are saved in a local JSON file. API keys and photos stay on this device.</div><Button variant="primary" disabled={busy} onClick={() => void exportData()}>{isNativeApp() ? 'Save or share backup' : 'Download backup'}</Button></Card><Card><div className="mb-2 font-medium">Restore backup</div><div className="mb-3 text-sm text-muted">Restoring replaces tracker data on this device. Your local API keys remain private and unchanged.</div><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-3 py-3 text-sm hover:border-muted"><input aria-label="Backup file" type="file" accept="application/json,.json" className="sr-only" onChange={(event) => { setFile(event.target.files?.[0]); setConfirmRestore(false); }} /><span className="rounded-lg bg-surface-2 px-3 py-1.5 font-medium">Choose file</span><span className="min-w-0 truncate text-muted">{file ? file.name : 'No backup selected'}</span></label><Button variant="danger" className="mt-3 w-full" disabled={!file || busy} onClick={() => void importData()}>{confirmRestore ? 'Tap again to replace data' : 'Restore backup'}</Button></Card>{status && <div role="status" className="text-sm text-muted">{status}</div>}</div>;
}

export default function ExtrasPage() {
  const section = useParams()['*'];
  const navigate = useNavigate();
  if (section === 'water') return <WaterPage />;
  if (section === 'measurements') return <MeasurementsPage />;
  if (section === 'photos') return <PhotosPage />;
  if (section === 'backup') return <BackupPage />;
  const title = section === 'measurements' ? 'Body measurements' : section === 'photos' ? 'Progress photos' : section === 'backup' ? 'Export and backup' : 'Extras';
  return <div className="mx-auto max-w-lg"><PageHeader title={title} right={section ? <Button variant="ghost" size="sm" onClick={() => navigate('/more')}>Back</Button> : undefined} /><EmptyState title="Coming in this Wave" body="This workflow is next in the Wave 4 build." /></div>;
}
