# Handoff (Claude ⇄ Codex)

Branch: `feature/app-build` on github.com/Codeittwice/MacroTrack. Read this file, then `git log`, before starting.

## Status (2026-09-25, Claude)

All plan waves are implemented. The app works as a browser PWA, as an Android APK (Capacitor 7) and as a Windows desktop app (Tauri 2).

| Area | State |
|---|---|
| Onboarding, settings, targets (coached/manual, per weekday) | done |
| Food log, search (NEVO + Open Food Facts NL + own foods + recipes), barcode, quick add, custom foods, recipes, saved meals, copy meal/day | done |
| AI: describe a meal, **meal photo**, **nutrition-label scan**, key test button; Claude/OpenAI/Gemini | done; grounded to NEVO/OFF |
| Weight trend (EMA with outlier guard), adaptive expenditure, weekly coach check-in | done, audited |
| Progress: weight trend, energy balance, goal projection, macro averages, nutrient history, measurements | done |
| Water, measurements, progress photos, backup/restore (share sheet on Android, rows validated) | done |
| Import history from MyFitnessPal / MacroFactor / any CSV (idempotent) | done |
| Reminders: weigh-in, food log, water and weekly check-in. Android: local notifications (verified). Web/desktop: dashboard prompts | done |
| Android: icons, splash, edge-to-edge insets, dark system bars | done, emulator-verified |
| Windows: exe + NSIS installer; data survives a restart | done, verified |

Verification at the last commit: `npm run build` ✓, `npm test` 290 ✓, `npm run e2e` 16 ✓ (desktop and Pixel 7), `npm run desktop:build` ✓, Android debug APK installed and exercised on the Pixel 7 API 35 emulator.

## Fixes in the 2026-09-25 Claude pass (what the audit of Codex's work found)

- **Claude AI calls always failed from the app.** The `anthropic-dangerous-direct-browser-access` header was missing, so the CORS preflight was rejected. Mocked tests can't catch this. It's now verified against the live API (an invalid key gets a readable 401).
- **One unlayered CSS rule overrode all Tailwind text colours on buttons and inputs.** `button { color: inherit }` did this, and primary buttons had light text on green. It now lives in `@layer base`.
- **The PWA service worker ran inside Capacitor/Tauri** and served the previous bundle after app updates. It's now registered only in the browser, and old registrations are removed.
- **The dashboard, coach and progress screens each showed a different expenditure.** The coach capped the first check-in at ±100 kcal from the onboarding TDEE even after months of data. They now share one definition, with the cap scaled by the days since the last target.
- **The weight outlier filter dropped the newest weigh-in**, and the first one after a break. It's now date-aware and needs contradicting readings on both sides.
- **Open Food Facts search returned nothing for queries like "AH turkse broodjes"**, and hit the ~10/min rate limit while typing. It now searches with normalised Dutch terms, caches queries and stays within a request budget.
- **Unit tests hit the live OFF API.** Network access is now blocked in `tests/setup.ts`.
- **Settings showed +0.34 kg/wk for a weight-loss rate.** The weekly rate on the Progress page also ignored the lb setting. Both are fixed.
- **Android**: the WebView drew under the status bar, the app had the default Capacitor icon, and exporting a backup did nothing (download links don't work in the WebView). All three are fixed.
- **Open Food Facts sodium was stored 1000× too low** (OFF reports grams, the app uses mg). Barcode lookups were cache-first and never refreshed. Printed portions ("1 broodje (90 g)") are now offered.
- **7 stale working-tree files** that undid Codex's commits were restored at the user's request. The diff is saved in the Claude session scratchpad.

## Known gaps / next steps

1. **NEVO data (user action).** Download the NEVO-online CSV from RIVM (rivm.nl → NEVO; accepting their licence is the user's call), save it to `data/raw/` and run `npm run nevo`. Until then generic foods come from Open Food Facts and AI, and Search is branded-first.
2. Test each AI provider once with a real user-owned key. There's a button for this in Settings → AI → Test key.
3. Test barcode scanning with a physical camera (emulator: set the back camera to Webcam0).
4. Optional: Supabase sync. For now, move data between phone and PC with Backup → Save/share → Restore.
5. Optional: a signed release APK and Play Store listing. Only debug builds are signed today.

## Builds

`release/` (gitignored) holds the latest `MacroTrack-android-debug.apk` (sideload) and `MacroTrack_0.1.0_x64-setup.exe` (Windows installer).

## How to test

- Web: `npm run dev`, `npm test`, `npm run e2e`.
- Android: `docs/ANDROID_TESTING.md`. The SDK is at `D:\Programs\Android\SDK`, JDK 21 at `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`. `scripts/android-cdp.mjs` runs JavaScript inside the app's WebView.
- Windows: `docs/WINDOWS_TESTING.md`. Launch with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224` and use `CDP_PORT=9224 node scripts/android-cdp.mjs "..."`.
