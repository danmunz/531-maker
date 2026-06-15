---
name: 531-workout-generator
description: "Use when generating a Jim Wendler 5/3/1 four-week workout routine from the local 1rms.csv, structure.csv, rules.md, and accessories.csv files, including training max calculations, FSL prescriptions, accessory selection, and dated markdown output in /routines."
---

# 5/3/1 Workout Generator

Generate a complete four-week 5/3/1 routine for this workspace using the local source files. Treat this skill as the canonical workflow for turning the repo inputs into a dated routine markdown file in /routines.

## Goal

Produce a routine file in /routines that:

- Uses the four-week markdown shape from template.md.
- Starts with a summary section above Week 1.
- Includes stable sync naming metadata for folder and routine titles.
- Uses simpler, repeatable assistance slots.
- Expands each training day into concrete 5/3/1 and FSL prescriptions with weights.
- Fills accessory slots with lifts chosen from accessories.csv.
- Assigns exact accessory sets and rep ranges.
- States explicitly which accessories are paired as supersets when a superset is used.
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

- structure.csv: the session skeleton, week/day order, and main-lift pairings.
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
- FSL means First Set Last: use the first work-set percentage from that week.
- FSL 5x5: 5 sets of 5 at the first-set percentage.
- FSL 3x5: 3 sets of 5 at the first-set percentage.
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
- Main Lift 1
- Main Lift 2
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
- Main Lift 1, Main Lift 2, and Accessories blocks for each day.
- Normal weeks with one explicit paired superset plus one standalone accessory.
- Deload week with only two standalone assistance movements.

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
- Define the routine title format as: `W[week]D[day]: [Main Lift 1 Short]/[Main Lift 2 Short]`
- Use concise short lift labels in titles: `Squat`, `Deadlift`, `Bench`, and `OHP`.
- For example, use titles such as `W1D2: Deadlift/Bench` or `W3D1: OHP/Squat`.
- Keep the naming deterministic so a future sync process can create or update the same app routines without ambiguity.

Routine overview table requirements:

- Use the same column order as structure.csv:
  - Week
  - Day
  - Main Lift 1
  - Main Lift 2
  - Accessory 1a
  - Accessory 1b
  - Accessory 2a
  - Accessory 2b
- In the overview table, use the concise day labels rather than full set-by-set prescriptions.
- Main lift labels should stay in the style of structure.csv, for example `Squat 5/3/1` or `Overhead Press FSL 5x5`.
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

### 3. Expand Main Lift Prescriptions

For every row in structure.csv:

- Parse the current week number.
- Identify the main lift in Main Lift 1.
- Identify whether Main Lift 2 is FSL 5x5 or FSL 3x5.
- Compute the week-specific loads from the lift TM.
- Replace generic placeholders with concrete prescriptions.

Preferred line format inside each day section:

- Main Lift 1: `- Squat 5/3/1 - 65%x5 (120), 75%x5 (140), 85%x5+ (155)`
- Main Lift 2: `- Overhead Press FSL 5x5 - 65% (70)`

Keep the lift names readable and consistent. Include the rep target and rounded load in each main-lift line.

### 4. Determine The Day's Accessory Needs

Before reading scores, classify the session from its main lifts.

Use these heuristics:

- Any day with Squat or Deadlift is lower-body influenced.
- Any day with Bench Press or Overhead Press is upper-body influenced.
- Bench Press is chest-focused pressing; Overhead Press is overhead shoulder-focused pressing.
- If both main lifts are upper-body presses, pulling volume must be at least equal to push volume.
- For normal weeks, default to exactly three assistance movements: 1 pull, 1 push-or-arms, and 1 core-or-lower movement.
- If Bench Press is the primary 5/3/1 lift, make the push-or-arms slot a chest push by default.
- If Bench Press appears only as secondary FSL on a lower-body-heavy day, the push-or-arms slot may be a low-fatigue chest push only after pulling and recovery needs are covered.
- If Overhead Press appears, bias at least one accessory toward upper back, lats, or rear/side delt support, and do not treat Overhead Press itself as chest work.
- If Deadlift appears, avoid extra heavy posterior-chain fatigue.
- If Squat appears, avoid piling on more heavy bilateral leg work.
- If the day is lower-body heavy overall, make the third slot core or lighter single-leg/hamstring work.
- If the day is Overhead Press-focused, make the push-or-arms slot triceps or shoulder-balance work.
- In deload week, reduce assistance to 2 movements total: 1 pull and 1 core or light lower-body movement.

### 5. Apply Rules Before Scores

Use rules.md as hard guidance. The ranking from accessories.csv is secondary.

Practical interpretation for this exercise pool:

- Pull rotation: Seated Row (Machine), Lat Pulldown (Cable), Pull Up (Assisted).
- Overhead Press-day push-or-arms rotation: Triceps Rope Pushdown, Triceps Extension (Dumbbell), Lateral Raise (Dumbbell).
- Bench Press-day chest push rotation: Incline Bench Press (Dumbbell), Incline Chest Press (Machine).
- Core rotation: Cable Crunch, Hanging Knee Raise.
- Lower-body assistance rotation: Lunge, Seated Leg Curl (Machine).
- Use caution with fatigue-heavy accessories: Romanian Deadlift (Barbell), Deadlift (Dumbbell), Kettlebell Swing, Bent Over Row (Barbell), Back Extension (Machine) on deadlift-heavy days.
- Use caution with extra bilateral leg fatigue on squat days: Leg Press (Machine), Goblet Squat, Kettlebell Goblet Squat, Leg Extension (Machine).

Reject accessories that clearly violate the day constraints even if they have a high combined_score.

### 6. Rank Valid Accessories

After filtering by rules, use accessories.csv to rank candidates.

Ranking priority:

1. Fits the rules.md constraints for that session.
2. Supports the main lifts or fills a missing movement pattern.
3. Fits the day's fixed assistance slots: 1 pull, 1 push-or-arms, 1 core-or-lower.
4. Preserves push/pull balance.
5. Higher combined_score.
6. Higher like score as final tie-breaker.

Avoid selecting the same accessory twice in one day. Prefer some variety across the week, but do not sacrifice fit just to rotate exercises.

### 6.5 Preserve Patterns, Rotate Exercises

Across a four-week block, repeated day types should keep the same accessory pattern but rotate the specific exercise choices.

Use day archetypes based on the main-lift pairing:

- Squat 5/3/1 + Bench Press FSL: 1 pull, 1 triceps-or-arms movement (avoid extra chest, Bench FSL covers it), 1 core-or-lower movement.
- Overhead Press 5/3/1 + Deadlift FSL: 1 pull, 1 triceps-or-shoulder movement, 1 core-or-lower movement.
- Bench Press 5/3/1 + Squat FSL: 1 pull, 1 chest push, 1 core movement.
- Deadlift 5/3/1 + Overhead Press FSL: 1 pull, 1 triceps-or-shoulder movement (to complement the OHP FSL), 1 core movement.
- Deload week for all day types: 1 pull and 1 core-or-light-lower movement only.

For each archetype:

- Keep the role pattern stable from week to week.
- Rotate the specific exercises inside each role when equivalent options exist.
- Keep the exercise pools small: 2 to 3 pull choices, 2 to 3 triceps-or-shoulder choices, 2 chest-push choices, 2 core choices, and 2 lower-body choices.
- Prefer not to use the same specific accessory more than twice in one four-week block when good alternatives exist.
- If only one exercise clearly fits a role, repeating it is acceptable, but rotate the other slots around it.

When choosing between two similarly good candidates, prefer the one that has been used less often earlier in the same four-week routine.

### 7. Fill The Accessory Slots

For normal weeks, use three accessory movements.

Populate the structure-style slots like this:

- Accessory 1a: pull
- Accessory 1b: push or arms
- Accessory 2a: core or single-leg/hamstring
- Accessory 2b: leave blank

For deload week, use only two assistance movements:

- Accessory 1a: pull
- Accessory 1b: leave blank
- Accessory 2a: core or light lower-body movement
- Accessory 2b: leave blank

Recommended slot pattern:

- Accessory 1a: pull
- Accessory 1b: push or arms
- Accessory 2a: core or lower-body support
- Accessory 2b: blank by default

A good default distribution is:

- Lower-body heavy day: 1 pull, 1 triceps-or-chest slot if pressing is present, and 1 core-or-lower slot.
- Bench Press-primary upper-body day: 1 pull, 1 chest push, and 1 core movement.
- Overhead Press-primary upper-body day: 1 pull, 1 triceps-or-shoulder slot, and 1 core-or-lower movement.
- Deload week: 1 pull and 1 core-or-light-lower movement only.

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
- `Accessory B`
- one standalone line: core or lower-body support

For deload week, format the accessory section as two standalone movements with no second superset required.

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
- Every main lift uses the correct TM and week percentage.
- Overhead Press rows use the OHP max from 1rms.csv.
- FSL uses the first-set percentage from the same week.
- Deadlift days do not include extra heavy posterior-chain loading unless the user explicitly wants it.
- Bench Press and Overhead Press days include enough pulling work.
- Lower-body heavy days include core or single-leg/hamstring work.
- Accessory names exactly match accessories.csv entries.
- Every accessory includes sets and reps.
- The assistance pattern is repeatable and easy to track.
- Deload week uses only two easier assistance movements per day.
- The file is saved in /routines with a date-based .md filename.

## Example Decision Pattern

For a row like `Squat 5/3/1` plus `Bench Press FSL 5x5`:

- Treat it as lower-body heavy with additional pressing volume from the Bench FSL secondary.
- Use 1 pull, 1 triceps-or-arms movement (not a chest push, since Bench FSL already covers chest), and 1 core or single-leg/hamstring movement in normal weeks.
- Avoid extra bilateral leg fatigue on top of the squat primary.
- Favor choices such as Lat Pulldown (Cable) or Seated Row (Machine), plus Triceps Rope Pushdown or Triceps Extension (Dumbbell), plus Cable Crunch, Hanging Knee Raise, or Seated Leg Curl (Machine).

For a row like `Overhead Press 5/3/1` plus `Deadlift FSL 3x5`:

- Treat it as OHP-primary upper-body work with lighter lower-body fatigue from the Deadlift FSL secondary.
- Use 1 pull, 1 triceps-or-shoulder movement, and 1 core or light lower-body movement in normal weeks.
- Avoid extra heavy posterior-chain loading on top of the Deadlift FSL.
- Favor choices such as Pull Up (Assisted) or Lat Pulldown (Cable), plus Triceps Extension (Dumbbell) or Lateral Raise (Dumbbell), plus Hanging Knee Raise, Cable Crunch, or Seated Leg Curl (Machine).

For a row like `Bench Press 5/3/1` plus `Squat FSL 5x5`:

- Treat it as Bench Press-primary upper-body work with lower-body fatigue from the secondary lift.
- Use 1 pull, 1 chest push, and 1 core movement.
- Favor choices such as Lat Pulldown (Cable) or Pull Up (Assisted), plus Incline Bench Press (Dumbbell) or Incline Chest Press (Machine), plus Cable Crunch or Hanging Knee Raise.
- Across repeated bench-primary days in the same block, rotate the chest accessory rather than repeating the same one each time.

For a row like `Deadlift 5/3/1` plus `Overhead Press FSL 5x5`:

- Treat it as lower-body heavy with additional pressing volume from the OHP FSL secondary.
- Use 1 pull, 1 triceps-or-shoulder movement (to complement the OHP FSL), and 1 core movement in normal weeks.
- Avoid extra heavy posterior-chain or lower-back loading on top of the deadlift primary.
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