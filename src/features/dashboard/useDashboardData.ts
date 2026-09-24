import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/schema';
import { alive } from '@/db/repo';
import { useProfile, useSettings, useTargets, getTargetSetFor } from '@/app/hooks';
import { useDayEntries, useDayTotals } from '@/lib/log/queries';
import { useWeights, useTrend } from '@/lib/weight/queries';
import { getDailyIntake } from '@/lib/log/queries';
import { addDays, today as todayFn } from '@/lib/utils/date';
import { loggingStreak, adherence, averageIntake, currentExpenditure } from '@/lib/stats';
import { projectGoalDate } from '@/lib/nutrition';

/** Aggregates everything the Dashboard page needs, memoised to avoid redundant recomputation. */
export function useDashboardData() {
  const today = todayFn();
  const profile = useProfile();
  const settings = useSettings();
  const targets = useTargets(today);
  const dayEntries = useDayEntries(today);
  const dayTotals = useDayTotals(today);
  const weights = useWeights();
  const trend = useTrend();

  const intake = useLiveQuery(() => getDailyIntake(addDays(today, -59), today), [today]);
  const latestTargetSet = useLiveQuery(() => getTargetSetFor(today), [today]);
  const tdee = latestTargetSet?.tdee;

  const hasCheckInToday = useLiveQuery(
    async () => (await db.checkins.where('date').equals(today).toArray()).some(alive),
    [today],
  );

  const expenditure = useMemo(
    () => (profile && weights && intake ? currentExpenditure({ profile, weights, intake, previous: tdee, today }) : undefined),
    [profile, weights, intake, tdee, today],
  );

  const streak = useMemo(() => {
    if (!intake) return undefined;
    return loggingStreak(
      intake.map((d) => d.date),
      today,
    );
  }, [intake, today]);

  const weeklyAverage = useMemo(() => (intake ? averageIntake(intake, 7, today) : undefined), [intake, today]);

  const weeklyAdherence = useMemo(() => {
    if (!intake || !targets) return undefined;
    const last7 = intake.filter((d) => d.date >= addDays(today, -6) && d.date <= today);
    return adherence(last7, targets.kcal);
  }, [intake, targets, today]);

  const goalEta = useMemo(() => {
    if (!profile || profile.goalWeightKg === undefined || !trend) return undefined;
    if (trend.latestTrendKg === undefined) return undefined;
    return projectGoalDate(trend.latestTrendKg, profile.goalWeightKg, trend.weeklyRateKg, today);
  }, [profile, trend, today]);

  const sparkline = useMemo(() => {
    if (!trend) return undefined;
    return trend.trend.slice(-30);
  }, [trend]);

  const weekAgoDelta = useMemo(() => {
    if (!trend || trend.trend.length === 0) return undefined;
    const last = trend.trend[trend.trend.length - 1];
    const targetDate = addDays(last.date, -7);
    let ref = trend.trend[0];
    for (const p of trend.trend) {
      if (p.date <= targetDate) ref = p;
      else break;
    }
    return last.value - ref.value;
  }, [trend]);

  return {
    today,
    profile,
    settings,
    targets,
    dayEntries,
    dayTotals,
    weights,
    trend,
    intake,
    expenditure,
    streak,
    weeklyAverage,
    weeklyAdherence,
    goalEta,
    sparkline,
    weekAgoDelta,
    hasCheckInToday,
  };
}
