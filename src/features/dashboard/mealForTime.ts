/** Pure helper: which meal index to prefill "Log food" with, based on time of day. */
export function mealForTime(date: Date, mealCount: number): number {
  const minutes = date.getHours() * 60 + date.getMinutes();
  let meal: number;
  if (minutes < 10 * 60 + 30) meal = 0; // before 10:30 -> breakfast
  else if (minutes < 15 * 60) meal = 1; // before 15:00 -> lunch
  else if (minutes < 21 * 60) meal = 2; // before 21:00 -> dinner
  else meal = 3; // otherwise -> snacks

  const max = Math.max(0, mealCount - 1);
  return Math.min(meal, max);
}
