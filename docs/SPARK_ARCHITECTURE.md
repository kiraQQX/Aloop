# Spark (瞬间) architecture

Spark is a product module inside the existing Aloop Vue shell. It is not a second project, a second HTML entry, or an iframe page.

## Integration with the shell

- **Route:** `#/spark` (plus `#/spark/library` and `#/spark/calibrate`). `src/App.vue` parses the hash, renders `SparkView` for the `spark` route, and keeps the existing shell language, account and menu behaviour.
- **Loading:** `SparkView` is a lazy async component, so other products pay nothing for it.
- **Legacy iframe lifecycle:** while Spark is active the iframe is only hidden (`v-show`), never reloaded and never pointed at Spark. `updateFrame('spark')` is a no-op, `onLegacyHashChange` is ignored, and WebGL is paused through `AloopGL.pauseAll(true)` (resumed on return). Leaving Spark shows the same iframe in the same state. A direct visit to `#/spark` leaves the iframe empty until another product is opened.
- **Language:** Spark reads the shell's `language` prop; `sparkCopy.js` only holds strings. There is no third language state.
- **Account:** the shell's `account` is passed in as a prop. Spark uses `src/lib/supabase.js`, `src/lib/auth.js` and the new Spark functions in `src/lib/data.js`.

## Modules

| Path | Role |
|---|---|
| `src/features/spark/SparkView.vue` | Layout, state-machine wiring, BCI lifecycle, motion controls |
| `SparkVisualizer.vue`, `sparkField.js` | Canvas 2D neural field (idle / guide / capture / reconstruct / result) |
| `SparkCapture.vue` | Guided imagery hold, text, voice, fragments, reference image |
| `SparkResult.vue` | Editable result card, provenance label, save / regenerate / sync |
| `SparkLibrary.vue` | Idea Capsule grid: search, filter, edit, delete, export, regenerate |
| `SparkCalibration.vue` | Optional eight-dimension self-rated imagery profile |
| `sparkStore.js` | Capture state machine, CRUD, local persistence, sync, privacy, motion |
| `src/lib/spark/bciAdapter.js` | BCI contract + `MockBciAdapter` + registry |
| `src/lib/spark/generationAdapter.js` | Generation contract, `DemoGenerationAdapter`, `RemoteGenerationAdapter` |
| `src/lib/spark/captureService.js` | Countdown, voice capture, input normalisation, image intake |
| `supabase/migrations/20261115090000_spark_ideas.sql` | `spark_ideas` table, RLS, private `spark-assets` bucket |

## Truthfulness rules

1. **The BCI is simulated.** `MockBciAdapter` emits one bounded `drive` number tagged `simulated: true`. It never emits channels, band powers, accuracy figures or decoded imagery. The UI always shows `SIMULATION MODE` and `SIMULATED NEURAL SIGNAL / 演示信号，不代表真实脑电采集`.
2. **Provenance is explicit.** Results carry `provenance`: `demo` (local render), `ai` (server-side service), and the contract reserves `device` and `inference` for a future real adapter. AI output is never described as read from the brain.
3. **No assumed AI platform.** `createGenerationAdapter` uses a server endpoint only when `VITE_SPARK_GENERATION_ENDPOINT` (an https URL, not a secret) is set. The endpoint owns credentials; the browser sends the prompt and the user's Supabase access token. Request/response contract is in `generationAdapter.js`. Without it the labelled demo adapter runs.
4. **The imagery profile is self-report**, skippable, editable and clearable, and is labelled as not a validated or clinical instrument.

## Replacing the simulation with real hardware

Implement `BciAdapter` (`checkDevice`, `connect`, `disconnect`, `subscribe`, `start`, `stop`, `calibrate`, `getSignalQuality`), tag frames `source: 'device'`, and `registerBciAdapter('my-device', factory)`. `SparkView` only needs `createBciAdapter('my-device')`. Keep device data, algorithmic inference and AI generation as separate provenance levels.

## Data and privacy

- No raw EEG and no audio are collected or stored. Voice uses the browser's speech-to-text (some browsers send audio to their vendor; the UI says so before the first use) and keeps only the transcript.
- Ideas are local by default (`localStorage`). Cloud sync is a per-idea click, available only when signed in and Supabase is configured. Every card shows `LOCAL ONLY` / `SYNCED` / `UNSYNCED CHANGES` / `SYNC FAILED`; failures show the real error.
- Synced ideas live in the account. Signing out removes cloud-synced copies from the browser.
- Reference images stay in memory for the current page only.
- Export (JSON) and delete-all (local and cloud) are in the library. Data is not used for model training.
- RLS restricts every `spark_ideas` row and every `spark-assets` object to `auth.uid()`. The bucket is private; previews are read with short-lived signed URLs.
- The preview image is uploaded to Storage; it is never inlined as Base64 in a database column.

## Tests

- `tests/spark-core.test.js`, `tests/spark-store.test.js`, `tests/spark-migration.test.js` — logic, state machine, adapters, CRUD, sync, privacy, migration.
- `src/features/spark/SparkView.test.js`, `spark-route.test.js` — component behaviour and the `#/spark` shell route, including iframe preservation.
- `tests/e2e/spark.e2e.js` — Playwright flows (menu entry, direct/reload/back/forward, language, capture → result → save → reopen, motion controls, permission denial, 390 px overflow, console errors).
