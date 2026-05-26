# 531 Maker

`531-maker` is a local-first Jim Wendler 5/3/1 planning repo with two jobs:

1. Generate a four-week 5/3/1 block from simple source files in this repo.
2. Sync the resulting block into Hevy and verify what was actually published.

The repo is intentionally structured so the workout logic stays human-readable and auditable:

- training maxes live in a CSV file
- week and day structure lives in a CSV file
- accessory constraints live in plain text and CSV
- generated routines are committed as markdown
- Hevy sync is a separate TypeScript CLI layer

This is not a general fitness app. It is a focused, opinionated workflow for generating and publishing one specific style of 5/3/1 programming.

## What This Repo Does

At a high level, the workflow is:

1. Read the local programming inputs.
2. Generate a dated four-week routine in `routines/`.
3. Convert that routine into Hevy routine payloads.
4. Create or update the corresponding Hevy routines.
5. Verify that the published routines actually match the source.
6. Optionally inspect Hevy workout history to determine whether a completed managed block is eligible for the next conservative 1RM bump.

The current implementation supports:

- deterministic 5/3/1 block generation from local files
- published Hevy routine creation and update
- published Hevy verification against the source routine
- first-pass Hevy history inspection for a future "next block from completion" workflow

## Repository Layout

Top-level files and folders:

- `1rms.csv`: source 1RMs in pounds
- `structure.csv`: the 12-session week/day skeleton
- `rules.md`: hard selection rules for accessories
- `accessories.csv`: ranked accessory pool
- `routines/`: generated routine markdown files
- `src/hevy-sync/`: TypeScript CLI for preview, sync, verify, and next-block reporting
- `hevy/`: config and local artifacts for Hevy integration
- `.github/skills/`: custom Copilot skills for generation workflows
- `docs/`: focused technical docs for Hevy sync behavior

Current custom skills:

- `.github/skills/531-workout-generator/SKILL.md`
- `.github/skills/531-next-block-from-hevy/SKILL.md`

## Source Of Truth

The programming inputs are intentionally separated by concern.

### `structure.csv`

Defines the exact week/day skeleton of the block.

Each row is one training session and includes:

- week
- day
- main lift 1
- main lift 2
- accessory placeholders

The current structure is a fixed 12-session block across 4 weeks.

### `1rms.csv`

Defines the current true 1RMs in pounds.

Current lifts tracked by this repo:

- Deadlift
- Squat
- Bench
- OHP

The generator converts these into training maxes using standard 5/3/1 logic.

### `rules.md`

Defines hard accessory-selection constraints.

This file is more important than raw accessory preference scores. If an accessory is a bad fit for the day, it should be rejected even if it ranks highly in `accessories.csv`.

### `accessories.csv`

Defines the allowed accessory pool and its ranking/preferences.

The generator uses this only after the hard constraints in `rules.md` have been applied.

## Programming Model

This repo currently follows standard Jim Wendler 5/3/1 assumptions unless intentionally overridden.

### Training Max

Training max is calculated as:

`TM = 90% of true 1RM`

### Main Work By Week

- Week 1: `65% x 5, 75% x 5, 85% x 5+`
- Week 2: `70% x 3, 80% x 3, 90% x 3+`
- Week 3: `75% x 5, 85% x 3, 95% x 1+`
- Week 4: `40% x 5, 50% x 5, 60% x 5`

### Secondary Work

`FSL` means First Set Last.

Supported variants in this repo:

- `FSL 5x5`
- `FSL 3x5`

### Weight Rounding

For the generated markdown routine, loads are authored in pounds and rounded to practical bar-loading values.

For Hevy publication, the repo now stores the kg payload with enough precision to preserve the intended lb display in the Hevy app.

This matters because Hevy stores kg internally and then converts back for display. Coarse kg rounding creates ugly lb values like `120.15`. The sync layer now avoids that.

## Generated Routine Shape

Generated routines live in `routines/YYYY-MM-DD.md` and follow a fixed markdown contract.

The output includes:

- top-level block title
- summary section
- sync naming metadata
- routine overview table
- muscle-group frequency table
- four weeks of sessions
- explicit main lift prescriptions
- explicit accessory prescriptions
- explicit superset declarations where used

The markdown template for this shape lives in:

- `.github/skills/531-workout-generator/template.md`

## Sync Naming Convention

Hevy publication depends on deterministic naming.

### Folder Name

Each managed block is published into a folder named:

`5/3/1 - YYYY-MM-DD Block`

### Routine Titles

Each published routine uses a short deterministic title:

`W[week]D[day]: [Main Lift 1 Short]/[Main Lift 2 Short]`

Examples:

- `W1D1: Squat/OHP`
- `W1D2: Deadlift/Bench`
- `W3D1: OHP/Squat`

This naming matters for two reasons:

1. repeat syncs update the same routines instead of duplicating them
2. future history-aware workflows can identify managed 5/3/1 blocks

## Hevy Integration

The repo uses a small TypeScript CLI in `src/hevy-sync/`.

It currently supports four main workflows:

- preview generated Hevy payloads
- sync routines to Hevy
- verify what was published
- inspect whether a completed managed block exists for the next conservative 1RM step

### Implementation Boundary

Two Hevy access paths are used:

- `hevy-mcp` for routine, folder, and exercise-template operations
- raw Hevy public API for some direct read operations like published-routine verification and workout-history lookup

That split is deliberate:

- MCP is convenient and agent-friendly for create/update flows
- raw API is necessary where MCP does not expose the required surface

## Commands

Install dependencies first:

```bash
npm install
```

### Preview A Routine For Hevy

Build the Hevy payloads locally without writing anything to Hevy:

```bash
npm run hevy:preview -- routines/2026-04-13.md --config hevy/hevy.config.example.json
```

This writes a preview payload JSON next to the routine unless an explicit `--out` path is provided.

### Sync A Routine Block To Hevy

Dry-run sync with live template resolution:

```bash
HEVY_API_KEY=your_key_here npm run hevy:sync -- routines/2026-04-13.md --config hevy/hevy.config.example.json --dry-run
```

Real sync:

```bash
HEVY_API_KEY=your_key_here npm run hevy:sync -- routines/2026-04-13.md --config hevy/hevy.config.example.json
```

Write the resolved dry-run payload to disk:

```bash
HEVY_API_KEY=your_key_here npm run hevy:sync -- routines/2026-04-13.md --config hevy/hevy.config.example.json --dry-run --out hevy/resolved-dry-run.json
```

### Verify The Published Hevy Routines

Verify published routines against the markdown source using the actual Hevy API response and effective lb display values:

```bash
HEVY_API_KEY=your_key_here npm run hevy:verify -- routines/2026-04-13.md --config hevy/hevy.config.example.json
```

This check validates:

- exercise order
- exercise identity / template IDs
- effective displayed lb values
- reps
- rep ranges
- set types
- superset relationships

### Inspect Hevy History For The Next Block

Dry-run the next-block report:

```bash
HEVY_API_KEY=your_key_here npm run hevy:next-block -- --config hevy/hevy.config.example.json
```

Write both JSON and a human-readable review file:

```bash
HEVY_API_KEY=your_key_here npm run hevy:next-block -- --config hevy/hevy.config.example.json --out hevy/next-block-report.json
```

Attempt to apply the conservative 1RM bump after review:

```bash
HEVY_API_KEY=your_key_here npm run hevy:next-block -- --config hevy/hevy.config.example.json --apply
```

Important:

- `next-block` is dry-run by default
- `--apply` is intentionally blocked unless a fully completed managed block is detected
- the current implementation does not automatically generate the next markdown block after apply; it prepares the approval and mutation step safely first

## Hevy Config Files

Two config files matter here.

### `hevy/hevy.config.example.json`

Safe example config intended for the repo.

### `hevy/hevy.config.json`

Local live config for real sync work.

This file is ignored and should stay local because it reflects live operator state and may include account-specific exercise template pinning.

## Secrets And Safety

### Hevy API Key

Do not commit your Hevy API key.

This repo accepts the key via environment variable and now also auto-loads repo-local `.env` and `.env.local` files.

For a persistent local setup, put this in `.env` at the repo root:

```bash
HEVY_API_KEY=your_key_here
```

Shell export still works:

```bash
export HEVY_API_KEY=your_key_here
```

or inline for a single command:

```bash
HEVY_API_KEY=your_key_here npm run hevy:verify -- routines/2026-04-13.md --config hevy/hevy.config.example.json
```

### Ignored Local Files

The repo intentionally ignores:

- `node_modules/`
- `.env`
- `.env.local`
- `hevy/hevy.config.json`
- generated next-block reports
- generated resolved dry-run payloads
- generated preview payloads

The current `.gitignore` is set up to prevent those from being uploaded by default.

### Safe Publish Rules

Before publishing or pushing changes:

1. confirm `hevy/hevy.config.json` is still ignored
2. confirm generated report files are ignored
3. confirm no literal API key appears in tracked files

## Current Custom Skills

### `531-workout-generator`

Purpose:

- generate a complete four-week block from local inputs

Inputs:

- `structure.csv`
- `1rms.csv`
- `rules.md`
- `accessories.csv`
- `.github/skills/531-workout-generator/template.md`

Output:

- a dated markdown routine in `routines/`

### `531-next-block-from-hevy`

Purpose:

- inspect Hevy workout history first
- determine whether a fully completed managed block exists
- propose conservative 1RM updates
- require approval before mutating `1rms.csv`
- then hand off to the standard generator

The current implementation supports the report and apply gate, but the full end-to-end handoff to automatic next-routine generation is still staged work.

## How The Current Next-Block Detection Works

The first version is intentionally conservative.

It only recognizes blocks that were created with the current managed naming convention:

- folder name: `5/3/1 - YYYY-MM-DD Block`
- routine titles like `W1D2: Deadlift/Bench`

It then checks raw Hevy workout history and looks for completed workouts whose `routine_id` matches those published managed routines.

If it finds a fully completed managed block, it proposes these fixed bumps:

- Deadlift: `+10 lb`
- Squat: `+10 lb`
- Bench: `+5 lb`
- OHP: `+5 lb`

The current implementation does not use rep-based max estimation yet.

## Why The History Workflow Is Conservative

The dangerous version of this feature is easy to build:

- scrape history
- guess what lift happened
- guess whether the block was done
- guess a new max
- write new numbers

That is exactly what this repo is trying to avoid.

The current workflow deliberately requires:

- a known managed block shape
- deterministic routine naming
- explicit completion detection
- dry-run review
- explicit apply mode

This keeps `1rms.csv` from being silently mutated based on weak history inference.

## Verification Philosophy

This repo now assumes that publishing is not done until the result is verified.

That is why `hevy:verify` exists.

The workflow should be:

1. generate the markdown block
2. sync to Hevy
3. verify the published routines against the source

This verification step is especially important because Hevy stores weights internally in kg and because routine update behavior can be stricter than it first appears.

## Known Behaviors And Lessons Already Baked In

The implementation already accounts for a few non-obvious Hevy behaviors.

### 1. Fixed-Reps Update Payloads Need `repRange`

When updating routines, Hevy can reject fixed-rep sets if the payload does not also include a fixed `repRange` object.

The sync layer now handles that.

### 2. Coarse kg Rounding Breaks lb Display

If kg values are rounded too aggressively before publication, Hevy will show ugly fractional lb values.

The sync now stores kg with fine enough precision to preserve the intended lb display.

### 3. Main Lift Template Matching Must Be Explicit

Loose exercise-template search is not good enough for the main barbell lifts.

Main lift mappings are pinned to explicit barbell templates.

### 4. Published Verification Must Check Real Display Values

Comparing raw payloads is not enough. The effective displayed values in the Hevy app matter.

The verification flow now checks that too.

## Example Working Session

One practical session for this repo might look like this:

1. update `1rms.csv` if needed
2. generate a new routine into `routines/YYYY-MM-DD.md`
3. preview or sync the block to Hevy
4. run `hevy:verify`
5. complete the block over time in Hevy
6. run `hevy:next-block` to see whether a completed managed block is eligible for the next conservative step
7. if the report looks right, rerun with `--apply`
8. generate the next block from the updated `1rms.csv`

## Current Limitations

This repo is useful now, but it still has intentional limits.

### Hevy History Detection

The current next-block logic only detects blocks that follow the new managed folder/title convention.

Older 5/3/1 routines in Hevy with other naming schemes are not yet inferred automatically.

### Automatic Next-Block Generation

The next-block workflow can prepare and apply conservative 1RM updates, but the fully automated approval-to-generation handoff is still staged work.

### No UI Yet

The repo currently stays CLI-first and skill-driven.

That is intentional. The likely first UI, if one is added later, would be a small local review screen for:

- matched completed workouts
- proposed 1RM updates
- publish verification summaries

It is not currently intended to become a full workout app.

## Development Notes

The main code lives in:

- `src/hevy-sync/cli.ts`
- `src/hevy-sync/parser.ts`
- `src/hevy-sync/payloads.ts`
- `src/hevy-sync/mcp.ts`
- `src/hevy-sync/workout-history.ts`
- `src/hevy-sync/one-rm-updater.ts`

The project uses:

- TypeScript
- `tsx` for local execution
- `@modelcontextprotocol/sdk`
- `zod`

Typecheck command:

```bash
npm run typecheck
```

## Contributing / Operating Rules

If you change this repo, keep these constraints intact:

- do not commit live Hevy config
- do not commit generated report artifacts
- do not weaken the approval gate on `next-block` by accident
- do not silently change the managed naming convention without updating detection logic
- do not loosen main-lift template matching heuristics without strong verification

## Roadmap

Most likely next improvements:

1. expand next-block detection to older 5/3/1 Hevy naming schemes
2. finish the approval-to-generation handoff after `next-block --apply`
3. improve pre-apply review further if needed
4. add a small local UI only if the review workflow becomes painful enough to justify the maintenance cost

## Quick Start

If you only need the shortest path:

```bash
npm install
HEVY_API_KEY=your_key_here npm run hevy:sync -- routines/2026-04-13.md --config hevy/hevy.config.example.json
HEVY_API_KEY=your_key_here npm run hevy:verify -- routines/2026-04-13.md --config hevy/hevy.config.example.json
HEVY_API_KEY=your_key_here npm run hevy:next-block -- --config hevy/hevy.config.example.json
```

If you are publishing this repo or sharing it, verify again that your local `hevy/hevy.config.json` and any generated Hevy report artifacts are still ignored before pushing.