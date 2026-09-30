import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { SupplementChecklist } from '@/features/supplements/SupplementChecklist';
import { LeftoversStrip } from '@/features/addfood/Leftovers';
import { CheckInBanner } from './CheckInBanner';
import { HeroCard } from './HeroCard';
import { QuickActions } from './QuickActions';
import { GlanceTiles } from './GlanceTiles';
import { Insights } from './Insights';
import { TodayMeals } from './TodayMeals';
import { WaterReminderBanner } from './WaterReminderBanner';
import { DailyPrompts } from './DailyPrompts';
import { formattedToday, greeting } from './format';
import { mealForTime } from './mealForTime';
import { useDashboardData } from './useDashboardData';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-2 ${className ?? ''}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <SkeletonBlock className="h-6 w-48" />
      <SkeletonBlock className="h-40 w-full" />
      <SkeletonBlock className="h-16 w-full" />
      <div className="grid grid-cols-3 gap-2">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
    </div>
  );
}

/**
 * Dashboard, top to bottom in order of how often it's checked: calories left and macros, one-tap
 * logging, leftovers, weight / training / water, today's meals, then the slower-moving numbers.
 */
export default function DashboardPage() {
  const data = useDashboardData();
  const now = useMemo(() => new Date(), []);

  const isLoading = data.profile === undefined || data.settings === undefined;
  if (isLoading) return <DashboardSkeleton />;
  // Router's OnboardingGate redirects when profile === null; render nothing meanwhile.
  if (data.profile === null) return null;

  const profile = data.profile!;
  const settings = data.settings;
  const meal = mealForTime(now, settings.mealNames.length);
  const showCheckIn = now.getDay() === profile.checkInWeekday && data.hasCheckInToday === false;

  return (
    <div className="flex flex-col gap-4 py-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
      <header className="flex items-end justify-between gap-3 lg:col-span-2">
        <div>
          <div className="text-sm text-muted">{greeting(now)}</div>
          <h1 className="text-2xl font-semibold">{formattedToday(now)}</h1>
        </div>
        {data.streak !== undefined && data.streak > 0 && (
          <span className="mb-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-muted" aria-label={`Logging streak: ${data.streak} days`}>
            <Flame size={13} className="text-kcal" /> {data.streak} {data.streak === 1 ? 'day' : 'days'}
          </span>
        )}
      </header>

      {/* empty:hidden: banners render nothing when not due, and an empty grid cell would leave a gap */}
      <div className="flex flex-col gap-3 empty:hidden lg:col-span-2">
        <CheckInBanner visible={showCheckIn} />
        <DailyPrompts settings={settings} weighedToday={!!data.weights?.some((w) => w.date === data.today)} loggedToday={(data.dayEntries?.length ?? 0) > 0} />
        <WaterReminderBanner settings={settings} />
      </div>

      <div className="flex flex-col gap-4">
        <HeroCard totals={data.dayTotals} targets={data.targets} />
        {data.targets?.exerciseKcal ? <p className="-mt-2 px-1 text-xs text-muted">Includes +{data.targets.exerciseKcal} kcal from today's training.</p> : null}
        <QuickActions meal={meal} />
        <LeftoversStrip date={data.today} meal={meal} onLogged={() => undefined} className="" />
      </div>

      <div className="flex flex-col gap-4">
        <GlanceTiles
          today={data.today}
          latestTrendKg={data.trend?.latestTrendKg}
          weeklyRateKg={data.trend?.weeklyRateKg}
          unit={settings.weightUnit}
          waterGoalMl={settings.waterGoalMl}
          losing={profile.goal === 'lose'}
        />
        <TodayMeals mealNames={settings.mealNames} entries={data.dayEntries} />
        <Insights
          expenditure={data.expenditure}
          goalEta={data.goalEta}
          goalWeightSet={profile.goalWeightKg !== undefined}
          weeklyAverage={data.weeklyAverage}
          today={data.today}
        />
        <SupplementChecklist linkToPage />
      </div>
    </div>
  );
}
