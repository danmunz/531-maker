---
name: 531-next-block-from-hevy
description: "Use when checking Hevy workout history before generating the next 5/3/1 block, proposing conservative 1RM bumps, requiring approval, updating 1rms.csv, and then handing off to the standard 531 generator."
---

# 5/3/1 Next Block From Hevy

Use this skill when the user wants to generate the next 5/3/1 block based on completed Hevy workout history.

This skill does not replace `531-workout-generator`. It runs before that generator and decides whether `1rms.csv` should be updated from completed block history.

## Goal

Before generating a new block:

1. Check Hevy workout history for a fully completed managed 5/3/1 block.
2. Produce a dry-run report with completion status and conservative proposed 1RM bumps.
3. Ask the user for approval before mutating `1rms.csv`.
4. If approved, apply the updates.
5. Then hand off to `531-workout-generator` to generate the next dated routine.

## Current Workflow Contract

Use the local CLI command:

```bash
HEVY_API_KEY=your_key_here npm run hevy:next-block -- --config hevy/hevy.config.json
```

This command is dry-run by default.

To apply approved 1RM changes:

```bash
HEVY_API_KEY=your_key_here npm run hevy:next-block -- --config hevy/hevy.config.json --apply
```

After approval and apply, continue with the normal local generation workflow using `531-workout-generator`.

## Safety Rules

- Never update `1rms.csv` without explicit user approval.
- Treat the dry-run report as the source of truth for whether a block was detected and whether it was fully completed.
- If no fully completed managed block is found, stop and report that no update should be applied.
- Do not estimate new maxes from AMRAP performance in v1. Use only the conservative bump policy already encoded in the CLI workflow.

## Current Detection Limits

The current implementation only detects app-managed Hevy blocks that match both of these conventions:

- Folder name: `5/3/1 - YYYY-MM-DD Block`
- Routine titles: `W[week]D[day]: Lift1/Lift2`

If the user's older Hevy history predates these conventions, report that limitation clearly instead of guessing.

## User-Facing Procedure

1. Run the dry-run `hevy:next-block` command.
2. Summarize:
   - how many managed blocks were found,
   - whether a completed block was detected,
   - what conservative 1RM updates are proposed.
3. Ask the user whether to apply the update.
4. If approved, run the `--apply` command.
5. Then generate the next block through `531-workout-generator`.

## Output Expectations

When reporting the dry-run result, include:

- the selected completed block date, if any,
- the matched completed routines,
- the current and proposed 1RMs,
- the current and proposed training maxes,
- any warnings about detection limits.