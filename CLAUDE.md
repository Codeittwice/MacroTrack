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

## Working rules
- Read `docs/CLAUDE_HANDOFF.md` first. Claude and Codex both work on this repo, and the handoff doc is the shared status log, so update it when you stop.
- Keep token use lean: do the work inline. Use at most one or two Sonnet agents for large independent chunks. No multi-layer agent armies (they exhausted the budget once).
- Gate every change with `npm run build`, `npm test` and `npm run e2e`. For native changes, also build the APK or desktop app.
- Unit tests must not touch the network (`tests/setup.ts` blocks `fetch`); stub it per test.
- Never register the service worker inside Capacitor/Tauri (see `src/main.tsx`).
