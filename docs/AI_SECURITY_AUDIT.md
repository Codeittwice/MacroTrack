# AI Security Audit

Reviewed: 2026-09-24

## Scope

The client-side provider adapters in `src/lib/ai/client.ts`, settings key storage, AI grounding, review-before-log flow, and portable backup behavior.

## Findings And Controls

| Area | Result | Control |
| --- | --- | --- |
| Provider selection | Pass | `estimateMeal` calls only the provider explicitly selected in Settings. |
| Key logging | Pass | No adapter logs request inputs, headers, or provider failures. Errors expose only a provider status code. |
| Gemini URL key exposure | Fixed | Gemini now sends its key in the `x-goog-api-key` header, not the request URL. |
| Input size | Fixed | Meal descriptions are trimmed and limited to 2,000 characters before any network request. |
| Provider output | Pass | Zod validates bounded item counts, names, portions, nutrients, and confidence before grounding or logging. |
| Nutrition authority | Pass | Strong local catalogue matches replace AI nutrition data; uncertain items remain visibly labelled as AI estimates and require review. |
| Backup privacy | Pass | JSON backups remove API keys; restoring preserves the current device's locally held keys. |
| Key at rest | Accepted limitation | User-owned keys are stored in IndexedDB for the selected browser/app profile. They are not hardware-backed or encrypted by MacroTrack. A compromised browser profile or XSS could expose them. |

## Regression Coverage

- `src/lib/ai/client.test.ts` verifies provider routing, malformed responses, error redaction, request-size limits, and Gemini header authentication.
- `src/lib/ai/grounding.test.ts` verifies matching, offline fallback, and schema rejection.
- `src/lib/backup/actions.test.ts` verifies exported backups omit keys and restores retain local keys.

## Evaluation Corpus

`npm run eval:ai` is offline and uses `data/fixtures/ai-eval.json`. It contains 30 portion-specified Dutch meal/product scenarios with declared reference totals, a representative raw estimate, and a grounded estimate. The command rejects a corpus smaller than 30 examples or a grounded result that does not improve calorie and protein MAPE over the raw estimates.

The fixture corpus is a regression benchmark, not a substitute for an evaluation using a user-owned provider key and licensed NEVO data. Re-run the evaluation with real model responses once those external prerequisites are available.

## Meal photos (added 2026-09-25)

- A photo is only sent when the user picks one and presses Estimate. It goes to the selected provider only, in the same request as the description.
- Photos are downscaled on the device to at most 1024 px (JPEG) before sending. They are never stored by MacroTrack.
- Photo requests use the provider's vision model (Claude Sonnet 5); text-only requests use Claude Haiku 4.5.
