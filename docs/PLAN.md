# MacroTrack Product Plan

MacroTrack is a standalone Android and Windows weight and macro tracker inspired by MacroFactor and MyFitnessPal. It logs food and weight, estimates meals with AI, and adapts nutrition targets as the user progresses. The app is local-first: data lives in IndexedDB and optional Supabase sync can be added later.

## Product Decisions

| Concern | Choice |
| --- | --- |
| Codebase | React 19, TypeScript and Vite; PWA for web, Capacitor for Android, Tauri for Windows |
| Styling | Tailwind CSS plus CSS-variable theme tokens |
| Data | Dexie over IndexedDB, with sync-ready `id`, `updatedAt` and `deletedAt` fields |
| State | Dexie `useLiveQuery` for data and Zustand for transient UI state where needed |
| Food search | MiniSearch over bundled NEVO data and user foods |
| Charts | Recharts plus a custom SVG macro ring |
| AI | User-provided provider key; Claude is the initial default, with OpenAI and Gemini adapters planned |
| Validation | Zod for imported and AI-generated data |
| Tests | Vitest for algorithms and Playwright for user-flow smoke tests |

## Visual System

The default theme is Fresh Dark: background `#0F1115`, surface `#171A21`, elevated surface `#20242D`, border `#2A2F3A`, text `#E8EAED`, and muted text `#9AA0AA`. Fresh green (`#4ADE80`) is the primary action and progress colour. Protein is coral (`#F87171`), carbs blue (`#60A5FA`), fat amber (`#FBBF24`), and calories violet (`#A78BFA`). Light mode uses a `#F7F8FA` background and white surfaces. Settings expose Ocean and Sunset accent alternatives. Inter and tabular numerals are used throughout.

## Main Screens

1. Onboarding collects body details, activity, goal, rate, and dietary preference, then calculates initial expenditure and macro targets.
2. Dashboard shows the daily calorie ring, macros against target, current trend weight, expenditure estimate, streak, and quick logging actions.
3. Food Log groups entries into renameable meals, supports date navigation, daily totals and micronutrients, and allows edit, delete, and copy actions.
4. Add Food combines local search, personal food library, recipes, online catalogue results, barcode scan, AI description/photo estimates, quick macro entries, and flexible serving units.
5. My Foods, Recipes, and Saved Meals allow reusable custom foods and multi-ingredient meals.
6. Weight supports multiple weigh-ins per day, body-fat percentage, notes, trend history, measurements, and progress photos.
7. Progress provides weight, expenditure, intake, adherence, macro and measurement history.
8. Adaptive Coach recalculates expenditure and proposes weekly targets for user approval.
9. Settings covers units, theme, API keys, backup/import/export and future sync.
10. Training (a bottom tab that replaced Weight; Weight log moved to More) logs gym workouts and sports: an exercise library, live workouts with a rest timer and last-time hints, templates, personal records and e1RM, and an anatomical front/back muscle map of weekly hard sets.
11. Supplements provide a daily dose checklist with adherence, reminders, and food-log entries for supplements with calories.
12. The body fat estimator (US Navy tape, waist-only RFM, visual guide) sits next to every body fat field. Progress shows body composition (body fat %, lean and fat mass).

## Food Sources

1. NEVO-online 2025/9.0 (2328 foods) is bundled, unchanged (no rounding), from the RIVM CSV into `public/data/nevo.json`, with Dutch and English names, macro nutrients and key micronutrients. It must work offline and retain the required attribution.
2. Open Food Facts supplies branded Dutch products and barcode lookups. Results are cached in Dexie.
3. Planned: Open Food Facts Bulgaria as a second product region (see Wave 8).
4. An Albert Heijn adapter is optional and experimental because no official public API exists.
5. User foods, recipes, and AI estimates fill remaining gaps. AI estimates can be saved as custom foods.

All sources use `FoodItem { id, source, name, brand?, per100, servings, barcode? }` so food-log history can snapshot nutrients and remain stable after source data changes.

## Nutrition Algorithms

- BMR uses Mifflin-St Jeor, or Katch-McArdle when body-fat percentage is available.
- Initial TDEE is BMR multiplied by the configured activity multiplier.
- Trend weight is an EMA with alpha around `0.1`, interpolating missing dates and excluding implausible isolated daily averages from the trend without deleting history.
- Adaptive expenditure uses average intake and the trend-weight energy change over a rolling 14-28 day window: `TDEE = avgIntake - (deltaTrendKg * 7700) / days`. It is smoothed against the prior estimate, capped at 100 kcal per week, and falls back to the initial calculation when the data is sparse. Missing and user-marked incomplete days are excluded.
- Calories derive from TDEE and the selected rate of gain or loss. Protein is 1.6-2.2 g/kg, fat has a minimum of 0.6 g/kg, and carbs fill remaining calories. Diet presets alter these ratios.
- Weekly check-ins recalculate expenditure and propose targets. Goal projection extrapolates the trend rate to the target weight.

Algorithms belong in `src/lib/nutrition/` as pure, fixture-tested functions.

## AI Estimation

AI is used chiefly to identify ingredients and estimate portions, not as the final nutrient authority. Provider adapters return an itemised schema with name, estimated grams, macros, confidence, and optional NEVO query. A grounding step searches NEVO and Open Food Facts and replaces an estimate's per-100 values when a strong match exists. Users review and edit the breakdown before logging it.

Inputs are a text description, a meal photo (downscaled on the device to 1024 px), or a nutrition-label photo (1600 px), which fills in a custom food. All three share one transport, `askProvider()` in `src/lib/ai/client.ts`. Planned: voice input, with Bulgarian speech translated to English before estimating (Wave 8).

Workout calories are, by default, NOT added to targets, because adaptive expenditure already includes training. Settings > Exercise calories can add half or all of a workout's estimated net burn ((MET - 1) x kg x hours) to that day's target as carbs.

The evaluation script benchmarks about thirty weighed Dutch meals and products, measuring calorie and protein error before and after grounding. API keys remain local and are only sent to the chosen provider. They must never be logged or exported.

## Data Model

Dexie tables (v1) are: `profile`, `settings`, `weights`, `measurements`, `foods`, `recipes`, `savedMeals`, `logEntries`, `targets`, `checkins`, `water`, `notes`, and `photos`. Schema v2 adds `exercises` (custom only; built-ins live in code), `workouts`, `workoutTemplates`, `supplements` and `supplementLogs`. Backups made before v2 still restore. Weight is stored in kilograms, energy in kcal, nutrient amounts in grams (sodium in mg), and dates as local `YYYY-MM-DD` keys. Log entries retain a nutrient snapshot and an optional per-100 snapshot so historical entries never change when a food is edited.

## Delivery Waves

| Wave | Scope | Exit Gate |
| --- | --- | --- |
| 0 | Foundation: Vite app, theme, shell, Dexie, PWA and Capacitor Android project | Browser builds and shell works on mobile/desktop; Android emulator boots |
| 1 | Nutrition maths, onboarding/settings, NEVO pipeline and search | Simulated TDEE is within 75 kcal; NEVO generation works; maths audit passes |
| 2 | Weight, food log/Add Food core, dashboard | Manual flow works: log weight, log food, dashboard totals update |
| 3 | Open Food Facts, barcode, recipes/saved meals, AI estimation | Grounding tests and evaluation script pass; API-key security audit passes |
| 4 | Coach, progress/statistics, measurements, photos, water, reminders, backup | Correct check-in proposal; export/import round-trips |
| 5 | Capacitor Android and Tauri Windows packaging | APK installs and Windows app launches with offline persistence |
| 6 | Optional Supabase sync | Offline edits from two devices converge |
| 7 | Additions (done 2026-09-25 to 29): photo/label AI, history import, reminders, body fat, Training + sports + muscle map, exercise calories, supplements | Unit and e2e tests green; verified on the emulator |
| 8 | Voice meal input with Bulgarian-to-English translation; Bulgarian products via Open Food Facts (done 2026-09-29) | See docs/CLAUDE_HANDOFF.md "Next: voice + Bulgarian" |
| QA | Full cross-project integration | Playwright smoke flow, manual checklist, and both platform builds pass |

## Ownership and Quality Gates

Waves run in sequence; workstreams within a wave have disjoint file ownership. The wave integrator owns shared files such as `package.json`, `vite.config.ts`, `src/app/routes.tsx`, `src/db/schema.ts`, and platform configuration. Work is accepted only with a cited build and test result, then independently reviewed from the diff.

## Current Progress

- Wave 0 is complete (`4608e40`).
- Wave 1 is complete (`f5047ac`) and its maths audit issues were fixed with regressions.
- Wave 2 and Wave 3 feature work are integrated and checkpointed on `feature/app-build` through the AI review flow (`358ebf7`).
- Wave 4 is complete on the current branch: weekly coach approval, progress statistics, water, measurements, local progress photos, guarded JSON backup/restore, and an in-app water reminder.
- The Wave 3 AI follow-up is complete on the current branch: a 30-scenario offline regression corpus reports raw and grounded calorie/protein error via `npm run eval:ai`, and the provider-key audit is recorded in `docs/AI_SECURITY_AUDIT.md`.
- Wave 5 Android packaging is verified: the debug APK installs and launches on a Pixel 7 API 35 emulator, and onboarding measurement fields have touch-native controls for AVDs without a working software keyboard.
- Wave 5 Windows packaging now has a Tauri host and reproducible NSIS installer build. The remaining exit-gate check is a native desktop launch with persisted offline data.
- The QA baseline is now executable in Chromium desktop and Pixel 7 emulation with `npm run e2e`; it covers onboarding and a quick food-log update end to end.
- NEVO 2025 is bundled (2026-09-27).
- Wave 7 additions are done (see docs/CLAUDE_HANDOFF.md). At the last check: 316 unit and 24 e2e tests passing.
- Wave 8 (voice + Bulgarian) is done. Official Bulgarian composition tables (NCPHA) are not used because of licensing; Open Food Facts BG plus translation to English (grounded on NEVO) cover it.

## Verification Checklist

- Run `npm run test` for pure logic and mutation APIs.
- Run `npm run build` for TypeScript and production bundle validation.
- Exercise onboarding, weight logging, food search, food logging, dashboard totals, and charts at mobile and desktop widths.
- Run Playwright mobile smoke coverage every wave.
- Before packaging, test Capacitor on an Android emulator/device, including camera and barcode flows, and test a Tauri build with persistent offline data.
