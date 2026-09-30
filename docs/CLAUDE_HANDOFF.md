# Handoff (Claude ⇄ Codex)

Branch: `main` on github.com/Codeittwice/MacroTrack. Read this file, then `git log`, before starting.

## Status (updated 2026-09-29, Codex; Wave 9 from 2026-09-30 is below)

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
| Past workouts and editable history (2026-09-29): Training → "Log a past workout" (date, start, duration, optional template) opens the editor; history is grouped per day with a + per day; finished workouts have Edit (name, date, time, duration, exercises, sets). `logPastWorkout`, `updateWorkoutTiming`, `tidyWorkout` in `src/lib/training/actions.ts`. Exercise library grown to 230 (abs/core, smith/machine variants, lunges/squats, Olympic, air bike, ski erg…) | done |
| Save as recipe + food-name language (2026-09-30): AI review has "Meal prep? Save as recipe" (servings, cooked weight, servings eaten now → logs that many servings of the recipe); each meal's ⋮ menu has "Save as recipe", which replaces the logged items with the servings eaten. Settings → Food search → Food names: English / Nederlands / Both (default Both: English with the Dutch name under it). Uses NEVO's bundled English names; `LogEntry.nameEn` snapshot, older NEVO entries look the name up via `loadNevoEnglishNames()`. `<FoodName>` in `src/components/FoodName.tsx`; actions `saveLogEntriesAsRecipe`, `logRecipeServings` | done |
| Shins (tibialis) muscle (2026-09-30): new `Muscle` value `shins`; the outer front lower-leg shape on the muscle map is now shins (was calves). Exercises: wall tibialis raise, tib bar raise, seated dumbbell tibialis raise, tibialis machine, banded dorsiflexion, heel walk | done |
| Android keyboard: adjustResize + `interactive-widget=resizes-content` + focus scroll-into-view (`src/app/keyboard.ts`); still to verify on a device | done, unverified on device |
| Voice meal input (Android recogniser / Web Speech / Gemini-OpenAI transcription), Bulgarian→English translation, Open Food Facts region NL/BG/both (`src/lib/native/speech.ts`, `src/lib/ai/translate.ts`, Settings > Food search / AI > Voice language) | done; mic permission and listening verified on the emulator; real speech still to test on a phone |
| Supplements: daily checklist (dashboard + page), adherence/streak, Android reminders (ids 200+), protein powder etc. add food-log entries | done (2026-09-28) |
| Android: icons, splash, edge-to-edge insets, dark system bars | done, emulator-verified |
| Windows: exe + NSIS installer; data survives a restart | done, verified |

Verification at the last commit: PR #1 and PR #2 merged into `main`; `npm run build` passed; `npm test` passed with 326 tests in 42 files; `npm run e2e -- --workers=1` passed with 28 tests (desktop and Pixel 7) including "logs a past workout, shows it under its day and edits it"; `npx playwright test -g "weekly check-in" --repeat-each 5 --workers=1` passed 10/10 after the e2e save-wait fix. `npm run android:apk` and `npm run desktop:build` passed. `release/MacroTrack-android-debug.apk` was rebuilt from `main` and installed with `adb install -r` on emulator-5554; `release/MacroTrack_0.1.0_x64-setup.exe` was rebuilt from `main` and run over the existing Windows install.

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

## Voice + Bulgarian (Wave 8): DONE 2026-09-29. The design below is as built.
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

## Wave 9 (2026-09-30, Claude): user feedback round, 16 items
Plan: `C:\Users\20243446\.claude\plans\so-now-for-new-velvety-summit.md`. All waves A–E are done and pushed. **Next: Wave F** (the extras the user approved: weekly review screen, progressive-overload hints and deloads, protein per meal and per kg, fibre and micronutrient targets, grocery list, Android widget). Sync is not wanted for now.
- **Dashboard redesign (approved mockup):** `HeroCard` (kcal left as the headline, a small % ring, one row of macro bars), round `QuickActions`, leftovers, `GlanceTiles` (weight / training / water), compact `TodayMeals` with a + per empty meal, `Insights` (expenditure, 7-day average, goal date) and the streak as a header chip. `StatTiles`, `WeightCard`, `TrainingTile` and `MacroRing` were removed.
- **Food-log counter:** eaten / target / left, one calorie bar, and thin macro bars with "P 95 / 153 g" underneath (`DaySummary`).
- The AI tab warms up `loadNevo()` on mount: the first index build could take >5 s and made the estimate look stuck.
- The user's voice bug ("a whole recipe gave 3 words") matches the stop-at-first-pause cause that was fixed.
- **Back button (Android):** `src/app/backStack.ts` + `@capacitor/app`. `Sheet` registers itself; back closes the top sheet, otherwise `history.back()`, and on `/` a second press within 2 s exits. Unit tested, **not yet tried on a device**.
- **Photo tab** in Add food (`AiEstimateTab mode="photo"`), a Photo quick action on the dashboard, and step-by-step progress while estimating.
- **Barcode indicator:** scan frame with a sweeping line, then primary once a code is read (with vibration), green "Found: …", or a clear "not in the database" message.
- **Food names default to English** (`foodNames: 'en'`). `withDefaults()` in `repo.ts` reads an old default 'both' as 'en' unless `foodNamesChosen` is set.
- **Voice fixes** (`speech.ts`): Android/Chrome end a session at the first pause, so it now restarts until Stop and joins the segments; "No match"/`no-speech` count as silence, not errors; `onFinal` appends to the current text (it used a stale closure). **Real speech still to be tried on the phone.**
- **Purple accent** (calories switch to teal under purple so they stay distinct). **Weigh-in line** toggle on the Weight/Progress trend chart (`useRawLinePref`, localStorage).
- **Meal prep / batches (schema v3):** `Batch` table + `LogEntry.batchId`. What's left is derived from alive entries, never stored, so edits/deletes put food back (`src/lib/batches/actions.ts`). The describe flow takes a long description (`Textarea`); the AI returns `dishName`, `portions`, `cookedGrams`; review has editable grams and macros (pencil), per-portion totals, and "Save meal prep and log N portions". Leftovers strip on Add food (Search/Library) and the dashboard; Recipes → Meal preps tab (`?view=preps`). The meal ⋮ "Save as recipe" with >1 serving now also creates a batch.
- **Grouped meals:** `LogEntry.groupId/groupName`. Saved meals log as one group; meal ⋮ → "Group as one item"; `GroupRow` expands to show the items. Copying a meal gives the copy a new group id.
- **More tab:** sections (Body, Nutrition, Training and habits, Data, App) plus search; Settings sections have anchors (`sectionId`), so e.g. `/settings#ai` scrolls there.
- **Training volume:** per-muscle landmarks (MEV / optimal range / MRV) in `volume.ts`, bands on the map (under, building, optimal, high, too much), a muscle sheet with a range bar and an 8-week chart, and a Weekly volume table (last 7 days vs the week before vs the 4-week average; rolling 7-day blocks to match the map).
- **Notifications:** training weekdays (ids 110–116), meal nudges that skip meals already logged (one-shot, 3 days ahead, ids 300–339), leftovers 3 days after cooking (ids 400–419). `ReminderSync` reschedules when today's log or leftovers change; the Reminders section only asks for permission now.
- **Expenditure audit:** the EMA trend slope was biased low early on (simulated true 2600: 2311 at 14 d, 2374 at 21 d). The weight change now comes from a least-squares line through the raw outlier-filtered weigh-ins (2496 / 2537). Days under 50% of the anchor are skipped as partly logged. `accuracy.test.ts` guards this. Coach → "How is this calculated?" explains it with the user's numbers.
- Verified: build, 360 unit tests (49 files), 36 e2e (`--workers=1`), `release/MacroTrack-android-debug.apk` rebuilt. No emulator was running, so nothing has been checked on a device.
- Gotcha: never round-trip files through PowerShell `Get-Content -Raw` (it double-encoded UTF-8 in 6 files; fixed).

## Fixes 2026-09-29 (afternoon, Claude)
- **Android keyboard covering fields (real cause):** with targetSdk 35 the app is edge-to-edge, where `adjustResize` no longer shrinks the window, and Capacitor's `adjustMarginsForEdgeToEdge` listener only reserves the system bars. `MainActivity.java` now replaces that listener and sets the WebView's bottom margin to max(system bars, IME). Verified on the emulator: innerHeight 839 → 527 with the keyboard open, back to 839 when closed; the weight sheet's Note field and Save stay visible.
- **Search in English ("butter", "chicken", "potato", "bread"):** `matchTier` in `src/lib/food-sources/search.ts` now ranks on the better of the Dutch and English NEVO names, with tie-breaks: Dutch-name match, then plain foods before NEVO back-to-front compounds ("Boter chocolade-"). Synonyms added: bread→brood, potato(es)→aardappel.
- **Muscle map missed sessions:** `finishWorkout` used to drop every set whose tick box wasn't tapped, so a session typed in without ticking lost its sets. Finish now keeps ticked OR filled-in sets (`isFilled`); `tidyWorkout` (finished workouts, sets start ticked) still keeps filled-in only. The Training map also counts the in-progress workout's ticked sets.

## Known gaps / next steps

1. **NEVO: done (2026-09-27).** NEVO-online 2025/9.0 (2328 foods) is bundled in `public/data/nevo.json` with values unchanged and RIVM's required credit. The raw RIVM files live in `data/raw/`, which git ignores. When RIVM publishes a new version, download it, put it in `data/raw/`, run `npx tsx scripts/build-nevo.ts data/raw/<file>.csv` and rebuild. The terms forbid charging users for NEVO data, so ask nevo@rivm.nl before publishing a paid app.
2. Test each AI provider once with a real user-owned key. There's a button for this in Settings → AI → Test key.
3. Test barcode scanning with a physical camera (emulator: set the back camera to Webcam0).
4. Optional: Supabase sync. For now, move data between phone and PC with Backup → Save/share → Restore.
5. Optional: a signed release APK and Play Store listing. Only debug builds are signed today.
6. Verify the Android keyboard fix on a real device, typing in bottom sheets such as Quick add and the workout sets.
7. Verify the keyboard fix on a real phone (emulator verified).
8. Sports minutes aren't shown on the muscle map; it counts strength hard sets only, by design.
9. The e2e test "weekly check-in proposes targets…" now waits for the "Targets updated for today." status before navigating; the focused repeat passed 10/10 on 2026-09-29. On this Windows machine, Playwright's dev server can saturate or hang during shutdown with high parallelism, so use `--workers=1` for reliable local e2e verification.
10. Rebuild `release/` (APK and installer) after any change. Cloud sessions can't: the Android SDK and Rust live on the user's PC.

## Builds

`release/` (gitignored) holds the latest `MacroTrack-android-debug.apk` (rebuilt and installed with `adb install -r` on 2026-09-29) and `MacroTrack_0.1.0_x64-setup.exe` (rebuilt and installed over the existing Windows app on 2026-09-29).

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
