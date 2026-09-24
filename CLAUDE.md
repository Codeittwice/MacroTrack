# MacroTrack

A weight and macro tracker (a MacroFactor/MyFitnessPal clone). It is one React + TypeScript + Vite codebase, shipped as a PWA, as an Android app via Capacitor (`android/`) and as a Windows app via Tauri (`src-tauri/`, added in Wave 5).
Data is local-first in IndexedDB (Dexie). The approved plan is in `C:\Users\20243446\.claude\plans\you-are-tasked-to-warm-newt.md`.

## Commands
- `npm run dev`: dev server on :5173
- `npm run build`: typecheck + production build (the gate for every wave)
- `npm test`: Vitest (jsdom + fake-indexeddb)
- `npm run e2e`: Playwright (desktop + Pixel 7)
- `npm run nevo`: builds `public/data/nevo.json` from the NEVO CSV in `data/raw/`
- Android: see `docs/ANDROID_TESTING.md`

## Conventions
- Domain types live in `src/db/types.ts`; the Dexie schema is in `src/db/schema.ts`.
- Units: kg, kcal, grams (sodium in mg). Dates are local `YYYY-MM-DD` strings (`DateKey`, helpers in `src/lib/utils/date.ts`).
- Records are soft-deleted (`deletedAt`). List queries filter with `alive` from `src/db/repo.ts`. New records use `newRecord()`.
- Log entries store a nutrient **snapshot**; never recompute history from the current food data.
- UI code imports the nutrition engine only from `@/lib/nutrition` (index.ts is the stable contract).
- UI primitives are in `src/components/ui`. Colours only come from theme tokens (`bg-surface`, `text-muted`, `text-protein`, `var(--carbs)` and so on); never hardcode hex values in feature code.
- Macro colours: protein = `--protein`, carbs = `--carbs`, fat = `--fat`, calories = `--kcal`.
- Each feature is a folder in `src/features/<name>/` whose default export in `index.tsx` is the page.

## Agent-army rules
- The Fable/Opus commander runs the waves. Opus leads own workstreams; Sonnet implementers do bounded tasks.
- Waves run one after another. Within a wave, file ownership is strictly disjoint.
- **Only the wave integrator edits these files:** `package.json`, `vite.config.ts`, `src/app/routes.tsx`, `src/app/hooks.ts`, `src/db/schema.ts`, `src/db/types.ts`, `src/components/ui/index.tsx`, `capacitor.config.ts` and `src-tauri/**`. Workers report the changes they need under "Flags for Commander".
- Workers never certify their own work. A report needs a green `npm run build` and the names of the passing tests.
