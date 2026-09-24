/**
 * Public API of the nutrition engine (contract). UI code imports ONLY from '@/lib/nutrition'.
 * Implementation modules import from each other / './types' directly, never from this file,
 * so there are no import cycles.
 */
export * from './types';

export { mifflinStJeor, katchMcArdle, bmr, initialTdee } from './bmr';
export { PROTEIN_G_PER_KG, computeTargets, targetsFromProfile, computeTargetsPerWeekday } from './targets';
export { trendWeight, weeklyRate, dailyAverages, interpolateDaily, lsSlopePerDay } from './trend';
export { estimateExpenditure, expenditureSeries } from './expenditure';
export { projectGoalDate } from './projection';
export { proposeCheckIn, type ProposeCheckInArgs, type ProposeCheckInResult } from './checkin';
