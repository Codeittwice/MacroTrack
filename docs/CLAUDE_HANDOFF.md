# Claude Handoff

## Current State

Branch: `feature/app-build`.

Committed milestones:

- Wave 0 foundation: `4608e40`.
- Wave 1 nutrition, onboarding/settings and NEVO pipeline: `f5047ac`.
- Wave 2 read contracts: `deabe7e`.

The working tree contains uncommitted Wave 2 work from multiple agents. Do not reset, checkout, or discard it. Read and preserve the existing changes before editing shared surfaces.

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
- `src/lib/recipes/actions.ts` adds validated, snapshot-safe mutations for recipes and saved meals. The recipe builder UI is still outstanding.

The data APIs used by the UI already exist in `src/lib/log/actions.ts`, `src/lib/foods/foods.ts`, and `src/lib/food-sources/search.ts`. Keep these as the write/search ownership points rather than duplicating IndexedDB work in feature components.

## Verification Evidence

Completed after the integration changes:

```text
npm run build  # passed; Vite PWA bundle produced
npm test       # passed; 24 files, 241 tests
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
3. Build the Recipe/Saved Meal/My Foods UI on the new recipe mutation API, including ingredient search and the ability to log a saved meal into a selected meal.
4. Add the barcode scanner UI. It will require `@zxing/browser` for web/desktop and Android camera/barcode permissions; do not request or accept permissions without the user present.
5. Add Playwright coverage, then commit the coherent Wave 2 and current Wave 3 changes. Do not include unrelated generated files.
6. Continue with AI estimation, grounding, and its security audit.

## Intentional Deferrals

- `Describe meal` currently opens Add Food with `?tab=ai`; it falls back to Search until Wave 3 registers the AI tab. No AI provider request is made yet.
- Open Food Facts search and offline caching are implemented, but barcode scanning UI and hardware permissions are not.
- Recipe and saved-meal persistence is implemented, but their builder/list UI and one-tap meal logging are not.
- Photo estimation and AI grounding have not been implemented.
- Adaptive coach, progress statistics, extras, Tauri packaging, and sync remain later waves.
- Existing audit items remain: onboarding activity/diet cards need better button semantics, expenditure shrinkage needs explicit test coverage, and outlier handling is not yet implemented.

## Suggested Message To Claude

> Please continue MacroTrack from the uncommitted Wave 2/Wave 3 integration on `feature/app-build`. Preserve the current working tree. Read `docs/PLAN.md` and `docs/CLAUDE_HANDOFF.md` first. Wave 2's custom-food-to-dashboard flow is verified. Wave 3 now has an Open Food Facts Netherlands adapter with Dexie caching and a tested recipe/saved-meal mutation API. Build the recipe/saved-meal UI next, then barcode scanning and AI grounding. NEVO source data and Playwright browser binaries are still external prerequisites.
