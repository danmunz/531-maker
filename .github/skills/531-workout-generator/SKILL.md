---
name: 531-workout-generator
description: "Use when generating a Jim Wendler 5/3/1 four-week workout routine from the local 1rms.csv, structure.csv, rules.md, and accessories.csv files, including training max calculations, accessory selection, and dated markdown output in /routines."
---

# 5/3/1 Workout Generator

Generate a complete four-week 5/3/1 routine for this workspace using the local source files. Treat this skill as the canonical workflow for turning the repo inputs into a dated routine markdown file in /routines.

## Goal

Produce a routine file in /routines that:

- Uses the four-week markdown shape from template.md.
- Starts with a summary section above Week 1.
- Includes stable sync naming metadata for folder and routine titles.
- Uses simpler, repeatable assistance slots.
- Expands each training day into one concrete 5/3/1 prescription with weights.
- Fills accessory slots with lifts chosen from accessories.csv.
- Assigns exact accessory sets and rep ranges.
- States explicitly which accessories are paired as supersets.
- Applies the constraints in rules.md before using preference scores.
- Names the file with an ISO date: YYYY-MM-DD.md.

If the user gives a specific start date, use it for the filename. Otherwise, use the current local date.

## Source Of Truth And Read Order

Read the source files in this order every time:

1. structure.csv
2. 1rms.csv
3. rules.md
4. accessories.csv

After the source files are resolved, read template.md and use it as the output layout.

Use each file for a different purpose:

- structure.csv: the session skeleton, week/day order, and the main lift per day.
- 1rms.csv: the maxes used to compute training maxes and work-set loads.
- rules.md: the hard constraints and tie-breakers for accessory selection.
- accessories.csv: the allowed accessory pool and preference ranking.
- template.md: the exact markdown structure for the finished routine document.

Do not invent exercises that are not present in accessories.csv. Do not change the week/day layout from structure.csv unless the user explicitly asks.

## Program Background

Use standard Jim Wendler 5/3/1 logic unless the user overrides it:

- Training max (TM) = 90% of true 1RM.
- Main lift weeks:
  - Week 1: 65% x 5, 75% x 5, 85% x 5+
  - Week 2: 70% x 3, 80% x 3, 90% x 3+
  - Week 3: 75% x 5, 85% x 3, 95% x 1+
  - Week 4: 40% x 5, 50% x 5, 60% x 5
- Each day has exactly one main lift — no secondary lift work.
- Round weights to the nearest 5 lb unless the user says to use a different increment.

Lift-name mapping for this workspace:

- Bench Press in structure.csv means barbell bench press and maps directly to Bench in 1rms.csv.
- Overhead Press in structure.csv means overhead press and corresponds to OHP in 1rms.csv.
- Squat and Deadlift map directly.

Accessory interpretation for upper-body main lifts:

- Bench Press is chest and triceps dominant pressing.
- Overhead Press is shoulder and triceps dominant pressing.
- Both Bench Press and Overhead Press count toward upper-body push volume.
- Overhead Press does not count as direct chest work.

If a calculated load lands exactly between increments, round to the nearest load the user can actually put on the bar. Favor practicality over false precision.

## Execution Workflow

### 1. Read The Structure

Open structure.csv and preserve the week/day order exactly:

- Week
- Day
- Main Lift
- Accessory 1a
- Accessory 1b
- Accessory 2a
- Accessory 2b

Each row is one training day. Preserve row order.

### 1.5 Read The Markdown Template

After the source files are understood, read template.md.

Use it to format the final output as:

- A top-level title with the routine date.
- A summary section before the week-by-week detail.
- A short sync naming section inside the summary.
- A routine overview table using the same columns and order as structure.csv.
- A muscle-group frequency table.
- Four week sections.
- Four day sections inside each week.
- Main Lift and Accessories blocks for each day.
- Normal weeks with two paired supersets (Superset A and Superset B).
- Deload week with one paired superset only.

Do not improvise a different layout unless the user asks for one.

### 2. Build Training Maxes

From 1rms.csv, compute TMs:

- Deadlift TM = 0.9 x Deadlift 1RM
- Squat TM = 0.9 x Squat 1RM
- Bench Press TM = 0.9 x Bench 1RM
- Overhead Press TM = 0.9 x OHP 1RM

For this workspace, the current TMs are:

- Deadlift: 265 lb
- Squat: 185 lb
- Bench Press: 155 lb
- Overhead Press: 105 lb

These values come from the current input files. Recompute them if 1rms.csv changes.

### 2.5 Build The Top Summary

Before writing Week 1, generate a summary section with two parts.

Sync naming requirements:

- Add a short `Sync Naming` subsection near the top of the summary.
- Use the routine file date as the block date for naming.
- Set the folder name to: `5/3/1 - YYYY-MM-DD Block`
- Define the routine title format as: `W[week]D[day]: [Main Lift Short]`
- Use concise short lift labels in titles: `Squat`, `Deadlift`, `Bench`, and `OHP`.
- For example, use titles such as `W1D2: OHP` or `W3D4: Deadlift`.
- Keep the naming deterministic so a future sync process can create or update the same app routines without ambiguity.

Routine overview table requirements:

- Use the same column order as structure.csv:
  - Week
  - Day
  - Main Lift
  - Accessory 1a
  - Accessory 1b
  - Accessory 2a
  - Accessory 2b
- In the overview table, use the concise day labels rather than full set-by-set prescriptions.
- Main lift labels should stay in the style of structure.csv, for example `Squat 5/3/1`.
- Accessory cells should contain only exercise names, not sets and reps.

Muscle-group frequency table requirements:

- Summarize direct programmed work across the full four-week routine.
- Use these summary groups: Back, Shoulders, Chest, Legs, Core, Arms.
- Map main lifts into those summary groups as follows:
  - Bench Press -> Chest
  - Overhead Press -> Shoulders
  - Squat -> Legs
  - Deadlift -> Legs
- Split accessories that would otherwise fall under `Back & Shoulders` into the summary groups with these mappings:
  - Back: Seated Row (Machine), Lat Pulldown (Cable), Dumbbell Row, Pull Up (Assisted), Bent Over Row (Barbell)
  - Shoulders: Lateral Raise (Dumbbell), Seated Overhead Press (Dumbbell), Shoulder Press (Dumbbell), Farmers Carry, Around The World
- For each muscle group, report:
  - Days Worked: number of training days where that group appears anywhere in the session.
  - Total Exposures: count each main-lift slot and each accessory slot that targets that group.
- If a group has no direct programmed work, show it as zero rather than omitting it.

### 3. Expand The Main Lift Prescription

For every row in structure.csv:

- Parse the current week number.
- Identify the main lift.
- Compute the week-specific loads from the lift TM.
- Replace generic placeholders with concrete prescriptions.

Preferred line format inside each day section:

- `- Squat 5/3/1 - 65%x5 (120), 75%x5 (140), 85%x5+ (155)`

Keep the lift name readable and consistent. Include the rep target and rounded load in each main-lift line.

### 4. Determine The Day's Accessory Needs

Before reading scores, classify the session from its main lift.

Use these heuristics:

- A day with Squat or Deadlift is lower-body focused.
- A day with Bench Press or Overhead Press is upper-body focused.
- Bench Press is chest-focused pressing; Overhead Press is overhead shoulder-focused pressing.
- For normal weeks, default to exactly two supersets of two: Superset A (1 pull + 1 push-or-arms) and Superset B (1 core-or-single-leg/hamstring + 1 complementary lower-body or core movement).
- If Bench Press is the main lift, make the push-or-arms slot in Superset A a chest push by default.
- If Overhead Press is the main lift, bias the push-or-arms slot in Superset A toward triceps or shoulder-balance work, and consider extra upper-back or rear-delt support.
- If Deadlift is the main lift, avoid extra heavy posterior-chain fatigue in Superset B.
- If Squat is the main lift, avoid piling on more heavy bilateral leg work in Superset B.
- If the day is lower-body heavy, make Superset B core plus a lighter single-leg/hamstring movement.
- In deload week, reduce assistance to 1 superset only: 1 pull and 1 core or light lower-body movement.

### 5. Apply Rules Before Scores

Use rules.md as hard guidance. The ranking from accessories.csv is secondary.

Practical interpretation for this exercise pool:

- Pull rotation: Seated Row (Machine), Lat Pulldown (Cable), Pull Up (Assisted).
- Overhead Press-day push-or-arms rotation: Triceps Rope Pushdown, Triceps Extension (Dumbbell), Lateral Raise (Dumbbell).
- Bench Press-day chest push rotation: Incline Bench Press (Dumbbell), Incline Chest Press (Machine).
- Core rotation: Cable Crunch, Hanging Knee Raise.
- Lower-body assistance rotation: Lunge, Seated Leg Curl (Machine).
- Use caution with fatigue-heavy accessories: Romanian Deadlift (Barbell), Deadlift (Dumbbell), Kettlebell Swing, Bent Over Row (Barbell), Back Extension (Machine) on deadlift days.
- Use caution with extra bilateral leg fatigue on squat days: Leg Press (Machine), Goblet Squat, Kettlebell Goblet Squat, Leg Extension (Machine).

Reject accessories that clearly violate the day constraints even if they have a high combined_score.

### 6. Rank Valid Accessories

After filtering by rules, use accessories.csv to rank candidates.

Ranking priority:

1. Fits the rules.md constraints for that session.
2. Supports the main lift or fills a missing movement pattern.
3. Fits the day's fixed slots: Superset A (pull + push-or-arms), Superset B (core-or-single-leg/hamstring + complementary movement).
4. Preserves push/pull balance.
5. Higher combined_score.
6. Higher like score as final tie-breaker.

Avoid selecting the same accessory twice in one day. Prefer some variety across the week, but do not sacrifice fit just to rotate exercises.

### 6.5 Preserve Patterns, Rotate Exercises

Across a four-week block, repeated day types should keep the same accessory pattern but rotate the specific exercise choices.

Use day archetypes based on the main lift:

- Squat day: Superset A = 1 pull + 1 triceps-or-arms movement; Superset B = 1 core movement + 1 light single-leg/hamstring movement.
- Overhead Press day: Superset A = 1 pull + 1 triceps-or-shoulder movement; Superset B = 1 core movement + 1 light lower-body movement.
- Bench Press day: Superset A = 1 pull + 1 chest push; Superset B = 1 core movement + 1 second pull or arms movement.
- Deadlift day: Superset A = 1 pull + 1 triceps-or-shoulder movement; Superset B = 1 core movement (avoid extra posterior-chain loading) + 1 light lower-body movement.
- Deload week for all day types: 1 pull and 1 core-or-light-lower movement only, as a single superset.

For each archetype:

- Keep the role pattern stable from week to week.
- Rotate the specific exercises inside each role when equivalent options exist.
- Keep the exercise pools small: 2 to 3 pull choices, 2 to 3 triceps-or-shoulder choices, 2 chest-push choices, 2 core choices, and 2 lower-body choices.
- Prefer not to use the same specific accessory more than twice in one four-week block when good alternatives exist.
- If only one exercise clearly fits a role, repeating it is acceptable, but rotate the other slots around it.

When choosing between two similarly good candidates, prefer the one that has been used less often earlier in the same four-week routine.

### 7. Fill The Accessory Slots

For normal weeks, use four accessory movements in two supersets.

Populate the structure-style slots like this:

- Accessory 1a: pull (Superset A)
- Accessory 1b: push or arms (Superset A)
- Accessory 2a: core or single-leg/hamstring (Superset B)
- Accessory 2b: complementary lower-body, core, or second pull/arms movement (Superset B)

For deload week, use only two assistance movements as a single superset:

- Accessory 1a: pull (Superset A)
- Accessory 1b: leave blank
- Accessory 2a: core or light lower-body movement (Superset A)
- Accessory 2b: leave blank

If the available pool makes the target slot pattern a poor fit for that day, keep the rule quality high rather than forcing a bad pick. Leaving a slot blank is better than violating recovery logic, but only do that as a last resort.

### 8. Assign Accessory Sets And Reps

Every accessory must include a set and rep prescription.

Use these defaults unless the user specifies something else:

- Pull movements: 3 to 4 x 10-12
- Triceps and lateral raise movements: 3 x 12-20
- Chest push movements: 3 x 10-15
- Core movements: 3 x 12-15
- Lower-body assistance movements: 3 x 12-20 or per-side where needed
- Romanian Deadlift (Barbell), Deadlift (Dumbbell), Kettlebell Swing: only use when appropriate for the day, and prescribe 3 x 8-12
- Farmers Carry: 3 x 30-40 m

In deload week, reduce assistance to 2 to 3 easy sets per movement and do not push assistance close to failure.

For unilateral work, note reps per side if needed.

### 9. Build Explicit Pairings

Do not leave accessory structure implicit.

For normal weeks, format the accessory section as:

- `Superset A`
- two accessory lines: pull plus push-or-arms
- `Superset B`
- two accessory lines: core-or-single-leg/hamstring plus a complementary movement

For deload week, format the accessory section as a single `Superset A` with two easy movements: pull plus core-or-light-lower.

## Output Contract

Write the finished routine to /routines/YYYY-MM-DD.md.

The file must:

- Be markdown.
- Follow template.md closely.
- Include the top summary section before Week 1.
- Include the sync naming subsection in that summary.
- Preserve the same week/day order as structure.csv.
- Replace placeholder lift text with actual set and load prescriptions.
- Fill accessory bullet items with exercise names exactly as written in accessories.csv.
- Include sets and rep targets for every accessory.
- Use the simplified assistance structure described above.

Do not modify structure.csv itself. Create a new dated markdown file in /routines.

## Quality Checks

Before finalizing a routine, verify:

- Every row still matches the original week/day structure.
- The markdown headings match the four-week template structure.
- The overview table uses the same column order as structure.csv.
- The summary appears before Week 1.
- The sync naming section is present and uses the routine date consistently.
- The muscle-group frequency table uses the documented main-lift mapping and accessory categories.
- Back and Shoulders are summarized separately.
- The main lift uses the correct TM and week percentage.
- Overhead Press rows use the OHP max from 1rms.csv.
- Deadlift days do not include extra heavy posterior-chain loading unless the user explicitly wants it.
- Bench Press and Overhead Press days include enough pulling work.
- Lower-body heavy days include core or single-leg/hamstring work.
- Accessory names exactly match accessories.csv entries.
- Every accessory includes sets and reps.
- The assistance pattern is repeatable and easy to track.
- Normal weeks use exactly two supersets of two accessories each.
- Deload week uses only one superset of two easier assistance movements per day.
- The file is saved in /routines with a date-based .md filename.

## Example Decision Pattern

For a `Squat 5/3/1` day:

- Treat it as lower-body heavy.
- Superset A: 1 pull and 1 triceps-or-arms movement.
- Superset B: 1 core movement and 1 light single-leg/hamstring movement.
- Avoid extra bilateral leg fatigue.
- Favor choices such as Lat Pulldown (Cable) or Seated Row (Machine), plus Triceps Rope Pushdown or Triceps Extension (Dumbbell), plus Cable Crunch or Hanging Knee Raise, plus Seated Leg Curl (Machine).

For an `Overhead Press 5/3/1` day:

- Treat it as OHP-primary upper-body work.
- Superset A: 1 pull and 1 triceps-or-shoulder movement.
- Superset B: 1 core movement and 1 light lower-body movement.
- Favor choices such as Pull Up (Assisted) or Lat Pulldown (Cable), plus Triceps Extension (Dumbbell) or Lateral Raise (Dumbbell), plus Hanging Knee Raise or Cable Crunch, plus Seated Leg Curl (Machine) or Lunge.

For a `Bench Press 5/3/1` day:

- Treat it as Bench Press-primary upper-body work.
- Superset A: 1 pull and 1 chest push.
- Superset B: 1 core movement and 1 second pull-or-arms movement.
- Favor choices such as Lat Pulldown (Cable) or Pull Up (Assisted), plus Incline Bench Press (Dumbbell) or Incline Chest Press (Machine), plus Cable Crunch or Hanging Knee Raise, plus a second pull or arms movement.
- Across repeated bench days in the same block, rotate the chest accessory rather than repeating the same one each time.

For a `Deadlift 5/3/1` day:

- Treat it as lower-body heavy.
- Superset A: 1 pull and 1 triceps-or-shoulder movement.
- Superset B: 1 core movement and 1 light lower-body movement.
- Avoid extra heavy posterior-chain or lower-back loading.
- Favor choices such as Seated Row (Machine) or Lat Pulldown (Cable), plus Triceps Rope Pushdown or Lateral Raise (Dumbbell), plus Cable Crunch or Hanging Knee Raise.

For repeated instances of the same day archetype across weeks:

- Keep the same role structure and rotate only inside the small approved pools.
- Avoid unnecessary extra variation.

## Default Behavior When The User Is Brief

If the user says only "generate my 5/3/1 routine" or similar:

- Read the four local source files in the required order.
- Read template.md after the source files.
- Use standard 5/3/1 percentages and TM logic above.
- Use current local date for the output filename.
- Generate one four-week markdown file in /routines.
- Include the overview table and muscle-group frequency summary at the top.
- Include the sync naming metadata at the top using the same date.
- Use the simplified accessory slot structure and lighter deload assistance.
- Summarize any noteworthy tradeoffs in accessory selection.
