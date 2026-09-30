import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button, Sheet } from '@/components/ui';
import type { ProposeCheckInResult } from '@/lib/nutrition';

const fmt = (n: number) => Math.round(n).toLocaleString();

/**
 * Explains the adaptive expenditure with this user's own numbers: energy balance over the last three
 * weeks, what was left out and why, and where the method comes from.
 */
export function HowCalculated({ proposal }: { proposal: ProposeCheckInResult }) {
  const [open, setOpen] = useState(false);
  const d = proposal.details;
  const learning = !d || d.daysUsed < 10;
  const storeKcal = d?.kgPerWeek !== undefined ? (d.kgPerWeek / 7) * 7700 : undefined;
  const measured = d?.avgIntake !== undefined && storeKcal !== undefined ? d.avgIntake - storeKcal : undefined;
  return (
    <>
      <Button variant="ghost" size="sm" className="self-start" onClick={() => setOpen(true)}><Info size={16} /> How is this calculated?</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="How expenditure is calculated">
        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          <p>
            MacroTrack measures your expenditure instead of guessing it. Energy in minus energy out shows up as a change in body weight, so over the last 21 days:
          </p>
          <div className="rounded-xl bg-surface-2 p-3 text-center font-medium">expenditure = average intake − weight change × 7,700 kcal/kg</div>

          {learning ? (
            <p>
              <span className="font-medium">Still learning:</span> {d?.daysUsed ?? 0} of the 10 logged days with a weigh-in it needs. Until then it uses the formula estimate from your profile, {fmt(d?.prior ?? proposal.expenditure)} kcal (Mifflin-St Jeor, or Katch-McArdle with a body-fat %, times your activity level).
            </p>
          ) : (
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 font-medium">Your numbers</div>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
                <dt className="text-muted">Days used</dt><dd>{d.daysUsed}{d.excludedDays ? ` (${d.excludedDays} left out)` : ''}</dd>
                {d.avgIntake !== undefined && <><dt className="text-muted">Average logged intake</dt><dd>{fmt(d.avgIntake)} kcal</dd></>}
                {d.kgPerWeek !== undefined && <><dt className="text-muted">Weight change</dt><dd>{d.kgPerWeek > 0 ? '+' : ''}{d.kgPerWeek.toFixed(2)} kg/week</dd></>}
                {storeKcal !== undefined && <><dt className="text-muted">Energy {storeKcal < 0 ? 'taken from' : 'stored in'} the body</dt><dd>{fmt(Math.abs(storeKcal))} kcal/day</dd></>}
                {measured !== undefined && <><dt className="text-muted">Measured from your data</dt><dd>{fmt(measured)} kcal</dd></>}
                <dt className="text-muted">Formula estimate (starting point)</dt><dd>{fmt(d.prior)} kcal</dd>
                <dt className="font-medium">Expenditure</dt><dd className="font-medium">{fmt(proposal.expenditure)} kcal</dd>
              </dl>
              {measured !== undefined && Math.abs(measured - proposal.expenditure) >= 10 && (
                <p className="mt-2 text-xs text-muted">The result sits between the measured value and the formula ({Math.round((d.daysUsed / (d.daysUsed + 5)) * 100)}% measured) and moves at most 100 kcal a week, so it settles as more days come in.</p>
              )}
            </div>
          )}

          <div>
            <div className="mb-1 font-medium">What keeps it honest</div>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li>Weight change is a straight line fitted through all your weigh-ins, so one salty dinner or a missed weigh-in barely moves it. Readings that disagree with the days on both sides by more than 3 kg are ignored.</li>
              <li>Days with nothing logged are skipped, never counted as 0 kcal. Days under half your expenditure are treated as partly logged and left out. You can also mark a day incomplete in the food log.</li>
              <li>With little data the result leans toward the formula, and it moves at most 100 kcal per week, so a few odd days can't swing your targets.</li>
            </ul>
          </div>

          <div>
            <div className="mb-1 font-medium">Limits</div>
            <p className="text-muted">
              It is only as good as your log. Consistent under-logging (oil, drinks, bites) makes expenditure look lower by the same amount, but your targets still work because they're measured against the same log. 7,700 kcal/kg is right for fat loss; in the first 1–2 weeks of a diet water and glycogen move the scale more than fat does, which is why early estimates are held close to the formula.
            </p>
          </div>

          <p className="text-xs text-muted">
            Based on the energy-balance method of adaptive tracking apps and on Hall et al. (2011, The Lancet) and Thomas et al. (2013) for why the fixed 3,500 kcal/lb (7,700 kcal/kg) rule works over weeks but not days. We checked the maths against simulated users with a known expenditure: within ~150 kcal after 2 weeks and ~100 kcal after 3 weeks of logging.
          </p>
        </div>
      </Sheet>
    </>
  );
}
