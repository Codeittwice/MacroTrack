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
- Wave 4 is complete: coach, progress, water, measurements, photos, backup/restore, and reminders are in `ad80961` (pushed to `origin/feature/app-build`).
- AI evaluation and provider-key security audit: `08a7b44`.
- Desktop/Pixel 7 onboarding, logging, dashboard, and backup/restore smoke coverage: `2953bc4` (with intermediate QA and nutrition-audit checkpoints also pushed).

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
- Wave 4 Measurements are live under More. Waist, chest, and hips can be logged for a date, edited through one daily upsert record, and removed from active history.
- Wave 4 Progress Photos are live under More. Local image blobs are validated, stored with date and pose metadata, displayed as private local previews, and require a deliberate second delete tap.
- Wave 4 Backup is complete. Export produces a versioned JSON backup of tracker records; import validates that shape, requires a second explicit restore action, replaces the portable data atomically, and retains local AI API keys. Photos intentionally remain local and are called out in the export UI.
- Wave 4 Reminders are complete. Settings now persist an opt-in water reminder time, and the Dashboard gives an actionable daily water prompt after that time while the user remains below the configured goal.
- The AI evaluation and security follow-up is complete. `npm run eval:ai` evaluates a 30-fixture offline Dutch meal/product corpus and enforces grounded calorie/protein MAPE improvement. The audit in `docs/AI_SECURITY_AUDIT.md` records the client-side risk boundary; Gemini keys now use the documented authentication header rather than a URL query parameter.
- Playwright now covers the primary first-run path in both desktop Chromium and Pixel 7 emulation: complete onboarding, open Food Log, quick-log a meal, confirm its Food Log total, and confirm that Dashboard receives the same total. It also downloads a real backup, adds water, restores through the two-tap UI confirmation, and verifies that the later water entry is removed. Onboarding activity, goal, and diet choices are semantic buttons with pressed state rather than clickable cards.
- The nutrition audit now has a direct shrinkage regression: at the 10-day evidence threshold the expenditure estimate is pulled toward its prior, and at 15 days it moves predictably closer to the same raw signal.
- Trend weight now excludes only implausible isolated daily averages from the computed trend. It does not delete raw history, leaves normal water-weight noise alone, and retains sustained changes that have neighbouring support.

The data APIs used by the UI already exist in `src/lib/log/actions.ts`, `src/lib/foods/foods.ts`, and `src/lib/food-sources/search.ts`. Keep these as the write/search ownership points rather than duplicating IndexedDB work in feature components.

## Verification Evidence

Completed after the integration changes:

```text
npm run build  # passed; Vite PWA bundle produced
npm test       # passed; 33 files, 268 tests
npm run cap:sync # passed; production PWA copied into Capacitor Android project
npm run eval:ai # passed; grounded MAPE improves calories 28.1% -> 4.7%, protein 38.1% -> 5.3%
npm run e2e     # passed; 4 desktop Chromium/Pixel 7 onboarding, logging, dashboard, and backup flows
```

Native Android validation completed on 2026-09-25:

```text
JDK 21 + Android SDK Platform 35/Build-Tools 34/35 + Emulator/Platform-Tools  # installed
Pixel_7_API_35 (Google APIs x86_64)                                            # created and booted
android/gradlew.bat installDebug                                                # APK built successfully
adb install -r app-debug.apk                                                     # installed successfully
nl.macrotrack.app/.MainActivity                                                  # launched and foregrounded
```

Use JDK 21 for this Gradle 8.11 project. Android Studio 2026 bundles Java 25, which fails with `Unsupported class file major version 69`.

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
2. Extend Playwright coverage to entry editing and recipes/saved meals. Chromium is installed on this host; desktop/mobile coverage already exercises onboarding, logging, dashboard totals, and backup/import.
3. Manually test the complete recipe and saved-meal save, edit, re-log, and delete flow in a browser, then add Playwright coverage for it.
4. Validate the barcode camera flow on a physical Android device or browser with a real camera. Confirm permission denial, cancellation, success, and the offline cached-product path.
5. Validate one request per configured provider with a user-owned test key before calling the AI work complete.
6. Add a native scheduled-notification adapter during Wave 5 if closed-app water notifications are required; the current Wave 4 reminder is deliberately an in-app dashboard prompt.

## Intentional Deferrals

- `Describe meal` opens the Add Food review flow. The selected provider is called only after the user enters a description and has a local key configured in Settings.
- Open Food Facts search, barcode lookup, and camera scanning UI are implemented. Hardware permission, cancellation, and real-product checks still need a physical-device validation.
- Recipe and Saved Meal creation, editing, deletion, and re-logging are implemented.
- Photo estimation is not yet implemented. The offline fixture evaluation and client-side security audit are complete; provider transports still require user-owned-key validation.
- Capacitor Android packaging, emulator setup, APK installation, and launch are now verified. Tauri packaging remains later-wave work. Wave 4 coach, progress statistics, extras, backup/import, and the in-app water reminder are implemented.
- Nutrition audit regressions cover sign convention, sparse-data shrinkage, smoothing, and isolated weight-typo handling.

## Suggested Message To Claude

> Please continue MacroTrack from the latest pushed checkpoint on `feature/app-build`. Wave 4 is complete: coach approval, progress statistics, water, measurements, local photos, versioned JSON backup/restore, and an in-app water reminder are all implemented. Wave 3 has Open Food Facts Netherlands search/cache, barcode lookup and opt-in camera scanning, recipe/saved-meal workflows, `Describe meal` provider transports with validation, grounding, review-before-logging, a 30-fixture offline evaluation command, and a documented security audit. The desktop and Pixel 7 Playwright onboarding/quick-log smoke test passes. The next meaningful work is Wave 5 packaging after Java/Android SDK and Rust/Tauri tooling are installed. NEVO source data, user-owned provider-key testing, physical camera validation, and platform tooling remain external prerequisites.
