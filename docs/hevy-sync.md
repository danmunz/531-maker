# Hevy Sync

This repo now includes a small TypeScript CLI for turning a generated 5/3/1 markdown routine into Hevy-compatible routine payloads and, when `HEVY_API_KEY` is present, syncing them through `hevy-mcp`.

The CLI now auto-loads `.env` and `.env.local` from the repo root before reading `process.env`, so local secrets can stay in a gitignored file instead of being re-exported in every shell.

## Commands

Install dependencies first:

```bash
npm install
```

Preview the generated payloads without talking to Hevy:

```bash
npm run hevy:preview -- routines/2026-04-13.md --config hevy/hevy.config.example.json
```

Verify the published Hevy routines against the source markdown using the actual stored routine data and effective lb display values:

```bash
HEVY_API_KEY=your_key_here npm run hevy:verify -- routines/2026-04-13.md --config hevy/hevy.config.example.json
```

Or place the key in a repo-local `.env` file once:

```bash
HEVY_API_KEY=your_key_here
```

Build a dry-run report for the next block by checking Hevy workout history for a fully completed managed 5/3/1 block and proposing conservative 1RM bumps:

```bash
HEVY_API_KEY=your_key_here npm run hevy:next-block -- --config hevy/hevy.config.example.json
```

When `--out` is provided, the command now writes both:

- a structured JSON report, and
- a human-readable review file ending in `.review.txt`

Apply the approved conservative 1RM bumps to `1rms.csv`:

```bash
HEVY_API_KEY=your_key_here npm run hevy:next-block -- --config hevy/hevy.config.example.json --apply
```

Sync through `hevy-mcp` with a real Hevy Pro API key:

```bash
HEVY_API_KEY=your_key_here npm run hevy:sync -- routines/2026-04-13.md --config hevy/hevy.config.example.json --dry-run
HEVY_API_KEY=your_key_here npm run hevy:sync -- routines/2026-04-13.md --config hevy/hevy.config.example.json
```

If you want the resolved dry-run payloads written to disk instead of printed:

```bash
HEVY_API_KEY=your_key_here npm run hevy:sync -- routines/2026-04-13.md --config hevy/hevy.config.example.json --dry-run --out hevy/resolved-dry-run.json
```

## What It Does

- Parses the current markdown routine shape from `routines/*.md`.
- Builds 12 Hevy routine drafts, one per week/day session.
- Treats pounds as the source-of-truth, then converts those already-rounded lb prescriptions to kg for the Hevy API with fine enough precision to preserve the intended lb display in Hevy.
- Preserves Superset A by assigning a shared `supersetId` to the paired accessory exercises.
- Resolves exercise template IDs via `search-exercise-templates` unless you pin them in config.
- Creates or updates routines by stable title so repeat syncs do not duplicate routines.
- Paces MCP calls and retries on likely rate-limit failures.
- Verifies published routines against the real Hevy API, including the effective lb values shown from stored kg loads.
- Can inspect raw Hevy workout history and detect whether the latest managed 5/3/1 block was fully completed before proposing the next conservative 1RM step.
- Produces both a structured machine-readable report and a human-readable review summary for approval before any `1rms.csv` mutation.

## Current Assumptions

- Main-lift weights in the markdown routine are pounds.
- Hevy payload weights are stored in kilograms, so the sync converts from the authored lb values and stores them with enough kg precision to preserve the intended lb display in the app.
- Exercise notes preserve the original lb-oriented prescription so the Hevy routine still reflects your source denomination.
- Accessory rep ranges default to fixed reps plus notes because Hevy's public API supports rep ranges but the app may not display them consistently.
- Folder creation is handled automatically when `folderName` is configured.
- The `next-block` workflow is intentionally conservative in v1: it only detects app-managed blocks stored in folders named `5/3/1 - YYYY-MM-DD Block`, requires a fully completed block, and proposes fixed 1RM bumps instead of rep-based max estimation.

## Config

See `hevy/hevy.config.example.json` for the initial config shape. The most useful fields are:

- `folderName`: target Hevy folder title.
- Routine titles default to short deterministic names like `W1D2: Deadlift/Bench` while the folder carries the block date.
- `useRepRanges`: if `true`, send `repRange` values instead of fixed reps for accessory ranges.
- `weightRoundingKg`: kg precision used when converting lb source weights. `0.001` keeps the displayed lb values aligned with the authored routine.
- `requestDelayMs`: minimum delay between Hevy MCP calls to avoid hammering the API.
- `maxRetries`: retry count for likely rate-limit failures.
- `retryBackoffMs`: base backoff used between rate-limit retries.
- `exerciseOverrides`: optional query or exact `templateId` overrides for specific exercise names.

The `next-block` command also accepts:

- `--lookback-days`: how many days of workout history to inspect. Default is `180`.
- `--apply`: write the proposed conservative 1RM bumps into `1rms.csv`. Without this flag, the command is dry-run only.

After a successful live dry-run in this workspace, a pinned config is available at `hevy/hevy.config.json`. It includes resolved `templateId` values for the current exercise set so future syncs can avoid repeated template searches and reduce rate-limit pressure.

## Next Work

- Tighten the exercise search heuristics after testing live against the Hevy account.
- Add a small validation command that lists unresolved or weak template matches before sync.
- Expand next-block detection beyond app-managed folders if older 5/3/1 Hevy routines need to be recognized safely.