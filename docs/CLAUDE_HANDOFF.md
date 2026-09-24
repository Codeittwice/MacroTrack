# Claude Handoff

## Current State

Branch: `feature/app-build`.

Committed milestones:

- Wave 0 foundation: `4608e40`.
- Wave 1 nutrition, onboarding/settings and NEVO pipeline: `f5047ac`.
- Wave 2 read contracts: `deabe7e`.
- Wave 2 integration and current Wave 3 foundations: `58897c6` (pushed to `origin/feature/app-build`).
- Wave 3 reusable recipe and saved-meal workflows: `1035390` (pushed to `origin/feature/app-build`).
- Wave 3 barcode lookup and opt-in scanner: `b7df528` (pushed to `origin/feature/app-build`).
- Wave 3 validated AI estimate grounding: `c297e4a` (pushed to `origin/feature/app-build`).
- Wave 3 provider transport and estimate review: `358ebf7` (pushed to `origin/feature/app-build`).

The Wave 2 and current Wave 3 work is checkpointed through `358ebf7`. Preserve subsequent working-tree changes; do not reset, checkout, or discard them.

## What Was Added In This Pass

- `docs/PLAN.md` captures the product direction, data model, algorithms, sources, delivery waves, and quality gates.
- `src/features/addfood/index.tsx` completes the Wave 2 Add Food UI:
  - Search across registered local sources.
  - Recent, frequent, and favourite food library.
  - Favourite toggles backed by the existing food library.
  - Amount and serving selection before logging.
  - Quick add for calories and macros.
  - Custom-food creation with optional custom serving.
  - Edit, move, rescale, and delete controls for existing log entries.
- `src/features/foodlog/index.tsx` now forwards `?tab=<id>` to Add Food, enabling later Wave 3 tab registration. It removes an unused date helper.
- `src/features/dashboard/index.tsx` has the TypeScript narrowing needed for production build.
- `src/features/addfood/index.test.tsx` adds component-level regression coverage for custom-food logging, quick add, and moving/rescaling an edited entry.
- Quick Add and amount fields now expose explicit accessible names, which the new tests enforce.
- `src/lib/food-sources/off.ts` adds the Open Food Facts source. It searches the Netherlands catalogue, maps public product data into `FoodItem`, caches results in Dexie, and falls back to cached branded products while offline.
- `src/lib/recipes/actions.ts` adds validated, snapshot-safe mutations for recipes and saved meals, including converting logged-food snapshots into reusable saved meals and re-logging every saved item into a target meal.
- `src/features/recipes/index.tsx` now provides a full local recipe workflow: search ingredients, change grams, calculate totals, specify cooked yield and servings, create recipes, and edit or soft-delete them. Saved meals can likewise be renamed, rescaled, trimmed, or soft-deleted from the same screen.
- Logged meals can now be saved as a reusable Saved Meal from each Food Log meal menu. Add Food > Library lists saved meals and logs all their items into the selected target meal.
- `getFoodByBarcode` normalizes scanned or typed EAN/UPC values and asks every barcode-capable source. It has coverage for valid input, invalid input, source fallback, and manual separators.
- Add Food now includes a Barcode tab. It supports typed/pasted codes and an explicit `Start camera` action backed by `@zxing/browser`; a successful lookup opens the existing amount-and-log flow. Android declares `CAMERA`, but the runtime prompt occurs only after the user starts a scan.
- `src/lib/ai/grounding.ts` establishes the safe AI boundary: Zod validates each provider estimate before use, strong NEVO/OFF name matches replace only the nutrition basis, and uncertain or offline items remain explicitly sourced as AI estimates. Regression tests cover grounding, fallback, offline operation, and malformed output rejection.
- `src/lib/ai/client.ts` now sends a meal description only to the selected configured provider (Claude, OpenAI, or Gemini), parses its provider-specific response envelope, and validates the result before grounding. It neither logs API keys nor includes them in user-facing errors. The Add Food `Describe meal` tab lets users adjust or remove each reviewed item before explicitly adding it to the log.
- Wave 4 Coach is now live. `src/lib/coach/actions.ts` derives a weekly proposal from local weight and intake history, records an accepted or declined review, and atomically applies a same-day coached target only after acceptance. The Coach page presents confidence, trend weight, weekly rate, expenditure, targets, and recent decisions.
- Wave 4 Progress now composes the existing live weight, intake, target, and expenditure queries into a range-controlled trend chart plus current trend weight, weekly rate, 28-day intake, adherence, expenditure confidence, and logged-day statistics.
- Wave 4 Water is live under More. A daily total is persisted in the existing sync-ready table, supports quick additions and a manual total, and tracks progress against the Settings water goal.

The data APIs used by the UI already exist in `src/lib/log/actions.ts`, `src/lib/foods/foods.ts`, and `src/lib/food-sources/search.ts`. Keep these as the write/search ownership points rather than duplicating IndexedDB work in feature components.

## Verification Evidence

Completed after the integration changes:

```text
npm run build  # passed; Vite PWA bundle produced
npm test       # passed; 28 files, 255 tests
```

Manual mobile smoke check at `http://127.0.0.1:5173`:

- Completed onboarding with a temporary non-personal development profile.
- Opened Food Log and Add Food.
- Confirmed the Search, Library, Quick add, and New food tabs render at a mobile viewport.
- Confirmed quick-add validation enables after valid calorie and macro input.
- Created a custom `Wave 2 smoke food`, changed its amount to 150 g, and logged it. Food Log displayed 360 kcal / 30 g protein / 15 g carbs / 18 g fat; Dashboard displayed the same totals, one logged meal, a one-day streak, and a 360 kcal weekly average.

The temporary profile and smoke food live only in the local development preview's IndexedDB. They are not repository data.

The existing NEVO fetch-failure test emits an expected `network down` diagnostic while passing.

## Known Gaps And Recommended Order

1. Add the RIVM-licensed NEVO source CSV under `data/raw/` and run `npm run nevo`. Until then Search correctly renders an empty result state because there is no bundled catalogue data.
2. Install Playwright browsers and add a mobile smoke test for onboarding, food logging, dashboard totals, and entry editing. The package is present but browser binaries were not installed during this pass.
3. Manually test the complete recipe and saved-meal save, edit, re-log, and delete flow in a browser, then add Playwright coverage once browser binaries are available.
4. Validate the barcode camera flow on a physical Android device or browser with a real camera. Confirm permission denial, cancellation, success, and the offline cached-product path.
5. Commit and push each completed Wave 3 checkpoint to `origin/feature/app-build`; do not include unrelated generated files.
6. Build the remaining Wave 4 measurements, photos, reminders, and backup/import workflows. Keep each coherent slice checkpointed and pushed to `origin/feature/app-build`.
7. Add roughly thirty weighed Dutch meal/product fixtures plus `npm run eval:ai` coverage for raw and grounded calorie/protein error. Finish the AI security audit and validate one request per configured provider with a user-owned test key before calling the AI work complete.

## Intentional Deferrals

- `Describe meal` opens the Add Food review flow. The selected provider is called only after the user enters a description and has a local key configured in Settings.
- Open Food Facts search, barcode lookup, and camera scanning UI are implemented. Hardware permission, cancellation, and real-product checks still need a physical-device validation.
- Recipe and Saved Meal creation, editing, deletion, and re-logging are implemented.
- Photo estimation and fixture-driven AI evaluation are not yet implemented. Provider transports, validation, grounding, and review-before-logging are implemented but still require user-owned-key and security-audit validation.
- Adaptive coach, progress statistics, extras, Tauri packaging, and sync remain later waves.
- Existing audit items remain: onboarding activity/diet cards need better button semantics, expenditure shrinkage needs explicit test coverage, and outlier handling is not yet implemented.

## Suggested Message To Claude

> Please continue MacroTrack from the latest pushed checkpoint on `feature/app-build`. Read `docs/PLAN.md` and `docs/CLAUDE_HANDOFF.md` first. Wave 2's custom-food-to-dashboard flow is verified. Wave 3 has an Open Food Facts Netherlands adapter with Dexie caching, barcode lookup and opt-in camera scanning, plus working recipe and saved-meal creation, management, and re-logging. `Describe meal` has provider transports, Zod validation, local-food grounding, and review-before-logging. Build the weighed-fixture evaluation script and complete the AI security audit next. NEVO source data, Playwright browser binaries, user-owned provider-key testing, and physical camera validation are still external prerequisites.
