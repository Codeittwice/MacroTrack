import { useMemo } from 'react';
import { CheckInBanner } from './CheckInBanner';
import { HeroCard } from './HeroCard';
import { QuickActions } from './QuickActions';
import { StatTiles } from './StatTiles';
import { TodayMeals } from './TodayMeals';
import { WeightCard } from './WeightCard';
import { WaterReminderBanner } from './WaterReminderBanner';
import { formattedToday, greeting } from './format';
import { mealForTime } from './mealForTime';
import { useDashboardData } from './useDashboardData';

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-surface-2 ${className ?? ''}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <SkeletonBlock className="h-6 w-48" />
      <SkeletonBlock className="h-40 w-full" />
      <SkeletonBlock className="h-24 w-full" />
      <div className="grid grid-cols-2 gap-3">
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
        <SkeletonBlock className="h-20" />
      </div>
    </div>
  );
}

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
    <div className="flex flex-col gap-4 px-4 py-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
      <div className="lg:col-span-2">
        <div className="mb-1 text-sm text-muted">{greeting(now)}</div>
        <h1 className="mb-3 text-2xl font-semibold">{formattedToday(now)}</h1>
      </div>

      <div className="lg:col-span-2">
        <CheckInBanner visible={showCheckIn} />
      </div>

      <div className="lg:col-span-2">
        <WaterReminderBanner settings={settings} />
      </div>

      <div className="flex flex-col gap-4">
        <HeroCard totals={data.dayTotals} targets={data.targets} />
        <QuickActions meal={meal} />
        <TodayMeals mealNames={settings.mealNames} entries={data.dayEntries} />
      </div>

      <div className="flex flex-col gap-4">
        <WeightCard
          latestTrendKg={data.trend?.latestTrendKg}
          weeklyRateKg={data.trend?.weeklyRateKg}
          weekAgoDelta={data.weekAgoDelta}
          sparkline={data.sparkline}
          unit={settings.weightUnit}
        />
        <StatTiles
          hasProfile={!!profile}
          expenditure={data.expenditure}
          streak={data.streak}
          goalEta={data.goalEta}
          goalWeightSet={profile.goalWeightKg !== undefined}
          weeklyAverage={data.weeklyAverage}
          today={data.today}
        />
      </div>
    </div>
  );
}
