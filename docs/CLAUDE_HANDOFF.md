# Handoff (Claude ⇄ Codex)

Branch: `feature/app-build` on github.com/Codeittwice/MacroTrack. Read this file, then `git log`, before starting.

## Status (updated 2026-09-29, Claude)

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
| Body fat estimator (US Navy tape, waist-only RFM, visual guide) wired to onboarding/profile/weigh-in; neck measurement; Progress body composition (BF %, lean/fat mass) | done (2026-09-28) |
| Training tab (replaces Weight tab; Weight log under More): ~100 built-in exercises + custom, live workout with rest timer and last-time hints, templates, PRs/e1RM, front/back muscle map of weekly hard sets (10–20 guideline); net burn estimate (MET − 1), cardio logged in minutes; Settings → Exercise calories Off/Half/Full adds it to that day's target as carbs (default Off) | done (2026-09-29) |
| Sports and activities (30, e.g. volleyball, basketball, korfball, hockey, padel), logged in minutes; sessions show active minutes and ~kcal instead of sets/volume; not counted as hard sets on the muscle map | done (2026-09-29) |
| Android keyboard: adjustResize + `interactive-widget=resizes-content` + focus scroll-into-view (`src/app/keyboard.ts`); still to verify on a device | done, unverified on device |
| Supplements: daily checklist (dashboard + page), adherence/streak, Android reminders (ids 200+), protein powder etc. add food-log entries | done (2026-09-28) |
| Android: icons, splash, edge-to-edge insets, dark system bars | done, emulator-verified |
| Windows: exe + NSIS installer; data survives a restart | done, verified |

Verification at the last commit: `npm run build` ✓, `npm test` 316 ✓, `npm run e2e` 24 ✓ twice in a row (desktop and Pixel 7), `npm run desktop:build` ✓, Android debug APK installed and exercised on the Pixel 7 API 35 emulator.

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

## Recent fix to know about (2026-09-29)
Settings > About used to call `loadNevo()`, which fetches the dataset AND builds the MiniSearch index. That slowed Settings enough that e2e tests navigating right after a click lost their IndexedDB writes. The credit now uses `loadNevoHeader()`. E2E tests must wait for a save to be visible (e.g. `aria-pressed="true"` on Segmented buttons, sheet hidden) before `page.goto`.

## Next: voice + Bulgarian (Wave 8, not started)
The user asked for:
1. Describing a meal by voice.
2. Bulgarian speech translated to English and entered into the description.
3. A Bulgarian equivalent of NEVO.

Plan:
- **Speech-to-text by platform:**
  - **Android:** `@capacitor-community/speech-recognition@7` (peer `@capacitor/core >=7`; adds the RECORD_AUDIO permission; language `bg-BG` / `nl-NL` / `en-US`; partial results). Android's WebView has no Web Speech API.
  - **Browser (Chrome):** `webkitSpeechRecognition`, with `lang` set from the setting.
  - **Windows (Tauri/WebView2):** there is no Web Speech API. Record with `MediaRecorder` and send the audio to Gemini (it accepts inline audio) or to OpenAI transcription, if the user has that key. Claude has no audio input, so hide the mic on desktop when only a Claude key is set.
  - **Setting:** add Settings > AI > "Voice language" (Auto / English / Nederlands / Bulgarian) to `Settings` in `src/db/types.ts` and its default in `src/db/repo.ts`.
- **Where it goes:** add a mic button to `src/features/addfood/AiEstimateTab.tsx`. Put the helper in `src/lib/native/speech.ts`, with a platform switch (`isNativeApp()`), start/stop, a transcript callback and permission handling.
- **Translation:** if the transcript contains Cyrillic (`/[Ѐ-ӿ]/`), call `askProvider()` with a short prompt: "Translate this meal description to English. Keep quantities, units and brand names. Return only the translation." Fill the description with the English text, show "Translated from Bulgarian: <original>" underneath, and let the user edit it before Estimate. The estimate prompt already handles non-English, but the user explicitly wants the English text entered.
- **Bulgarian food data:**
  - The official source is the Bulgarian food composition tables of the National Center of Public Health and Analyses (NCPHA), partly available through EuroFIR. It is not known to be an open download, so its availability and licence still need checking with the user or NCPHA.
  - Practical now: add Open Food Facts Bulgaria (`countries_tags=bulgaria`) as a second region. Use a Settings "Product region: Netherlands / Bulgaria / both" that `src/lib/food-sources/off.ts` reads, and keep the rate-limit budget shared.
  - After translation to English, generic foods still ground against NEVO's English names.
- **Tests:**
  - unit: Cyrillic detection plus the translation call (mock `fetch`), and OFF region parameters
  - e2e: speech isn't available headless, so stub the speech helper and assert the translated text appears
  - Android: the permission prompt and recognition on the emulator (host mic)

## Known gaps / next steps

1. **NEVO: done (2026-09-27).** NEVO-online 2025/9.0 (2328 foods) is bundled in `public/data/nevo.json` with values unchanged and RIVM's required credit. The raw RIVM files live in `data/raw/`, which git ignores. When RIVM publishes a new version, download it, put it in `data/raw/`, run `npx tsx scripts/build-nevo.ts data/raw/<file>.csv` and rebuild. The terms forbid charging users for NEVO data, so ask nevo@rivm.nl before publishing a paid app.
2. Test each AI provider once with a real user-owned key. There's a button for this in Settings → AI → Test key.
3. Test barcode scanning with a physical camera (emulator: set the back camera to Webcam0).
4. Optional: Supabase sync. For now, move data between phone and PC with Backup → Save/share → Restore.
5. Optional: a signed release APK and Play Store listing. Only debug builds are signed today.
6. Verify the Android keyboard fix on a real device, typing in bottom sheets such as Quick add and the workout sets.
7. "boterham" ranks rolls before sliced bread in NEVO search (minor).
8. Sports minutes aren't shown on the muscle map; it counts strength hard sets only, by design.
9. Rebuild `release/` (APK and installer) after any change. Cloud sessions can't: the Android SDK and Rust live on the user's PC.

## Builds

`release/` (gitignored) holds the latest `MacroTrack-android-debug.apk` (sideload) and `MacroTrack_0.1.0_x64-setup.exe` (Windows installer).

## How to test

- Web: `npm run dev`, `npm test`, `npm run e2e`.
- Android: `docs/ANDROID_TESTING.md`. The SDK is at `D:\Programs\Android\SDK`, JDK 21 at `C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot`. `scripts/android-cdp.mjs` runs JavaScript inside the app's WebView.
- Windows: `docs/WINDOWS_TESTING.md`. Launch with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224` and use `CDP_PORT=9224 node scripts/android-cdp.mjs "..."`.

## Schema notes (v2, 2026-09-28)
Dexie `version(2)` adds `exercises`, `workouts`, `workoutTemplates`, `supplements`, `supplementLogs`. Backups include them; backups from before v2 still restore (these tables are optional). Workout edits go through a per-workout queue in `src/lib/training/actions.ts`, because unawaited input updates used to overwrite each other.

## Dev server note
The Browser-pane preview server (`.claude/launch.json`) sometimes starts with a different Vite root and serves this project through `/@fs/` with stale transforms. If UI changes don't show up, stop it and run `npx vite --port 5173` from the project root.

## Android SDK note (2026-09-29)
The `android-35` system image had disappeared from `D:\Programs\Android\SDK`. It was reinstalled with the new `cmdline-tools/latest/bin/sdkmanager.bat`. Launch the emulator with `ANDROID_SDK_ROOT` set, and use `-gpu swiftshader_indirect` if it hangs while offline.
