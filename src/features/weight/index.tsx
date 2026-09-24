import { useMemo, useState } from 'react';
import { Plus, Scale } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Segmented } from '@/components/ui';
import { TrendChart, type TrendRange } from '@/components/charts/TrendChart';
import { useWeights, summarizeTrend } from '@/lib/weight/queries';
import { useProfile, useSettings } from '@/app/hooks';
import type { WeightEntry } from '@/db/types';
import { toDateKey } from '@/lib/utils/date';
import { WeightHeader } from './WeightHeader';
import { WeightStats } from './WeightStats';
import { WeightSheet } from './WeightSheet';
import { WeightHistory } from './WeightHistory';

const RANGE_OPTIONS: { value: TrendRange; label: string }[] = [
  { value: '7D', label: '7D' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
];

const RANGE_STORAGE_KEY = 'weight.range';

function loadRange(): TrendRange {
  try {
    const v = localStorage.getItem(RANGE_STORAGE_KEY);
    if (v && RANGE_OPTIONS.some((o) => o.value === v)) return v as TrendRange;
  } catch {
    // ignore
  }
  return '3M';
}

function saveRange(range: TrendRange) {
  try {
    localStorage.setItem(RANGE_STORAGE_KEY, range);
  } catch {
    // ignore
  }
}

export default function WeightPage() {
  const weights = useWeights();
  const settings = useSettings();
  const profile = useProfile();
  const unit = settings.weightUnit;

  const [range, setRange] = useState<TrendRange>(loadRange);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<WeightEntry | undefined>(undefined);

  const summary = useMemo(() => (weights ? summarizeTrend(weights) : undefined), [weights]);

  function handleRangeChange(r: TrendRange) {
    setRange(r);
    saveRange(r);
  }

  function openNew() {
    setEditEntry(undefined);
    setSheetOpen(true);
  }

  function openEdit(entry: WeightEntry) {
    setEditEntry(entry);
    setSheetOpen(true);
  }

  const loading = weights === undefined;
  const isEmpty = !loading && weights.length === 0;

  const firstTrend = summary?.trend[0];

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <PageHeader
        title="Weight"
        right={
          <button
            aria-label="Log weight"
            onClick={openNew}
            className="hidden h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary md:inline-flex"
          >
            <Plus size={20} />
          </button>
        }
      />

      {loading && <div className="py-10 text-center text-sm text-muted">Loading…</div>}

      {isEmpty && (
        <>
          <EmptyState
            icon={<Scale size={32} />}
            title="No weigh-ins yet"
            body="Weigh yourself daily for the best results — the trend line smooths out day-to-day fluctuations like water and food weight, so you can see what's actually happening."
            action={
              <Button variant="primary" size="lg" onClick={openNew}>
                <Plus size={18} />
                Log weight
              </Button>
            }
          />
          <WeightSheet open={sheetOpen} onClose={() => setSheetOpen(false)} unit={unit} entry={undefined} lastWeightKg={undefined} />
        </>
      )}

      {!loading && !isEmpty && weights && summary && (
        <>
          <Button variant="primary" size="lg" className="mb-4 w-full md:hidden" onClick={openNew}>
            <Plus size={18} />
            Log weight
          </Button>

          <WeightHeader
            latestTrendKg={summary.latestTrendKg}
            weeklyRateKg={summary.weeklyRateKg}
            unit={unit}
            goalWeightKg={profile?.goalWeightKg}
            goalType={profile?.goal}
            firstTrendKg={firstTrend?.value}
            firstTrendDate={firstTrend?.date}
            startWeightKg={profile?.startWeightKg}
            startDate={profile?.onboardedAt ? toDateKey(new Date(profile.onboardedAt)) : undefined}
          />

          <Card className="mb-4">
            <Segmented options={RANGE_OPTIONS} value={range} onChange={handleRangeChange} className="mb-3" />
            <TrendChart
              weights={weights.map((w) => ({ date: w.date, kg: w.kg }))}
              trend={summary.trend}
              range={range}
              unit={unit}
              goalKg={profile?.goalWeightKg}
            />
          </Card>

          <div className="mb-6">
            <WeightStats
              trend={summary.trend}
              unit={unit}
              goalWeightKg={profile?.goalWeightKg}
              weeklyRateKg={summary.weeklyRateKg}
              latestTrendKg={summary.latestTrendKg}
            />
          </div>

          <WeightHistory weights={weights} trend={summary.trend} unit={unit} onSelect={openEdit} />

          <WeightSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            unit={unit}
            entry={editEntry}
            lastWeightKg={editEntry ? undefined : weights.at(-1)?.kg}
          />
        </>
      )}
    </div>
  );
}
