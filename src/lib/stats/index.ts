/**
 * Public API of the stats module (contract). Pure functions only — no Dexie, no React.
 * UI code (Dashboard) imports from here.
 */
export { loggingStreak } from './streak';
export { adherence, averageIntake } from './intake';
export { currentExpenditure, type CurrentExpenditureArgs } from './expenditure';
