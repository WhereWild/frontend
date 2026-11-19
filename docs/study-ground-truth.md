# Visualization study: design decisions and ground truth

Decisions only. Every **Justification** line is left for the researcher to write;
nothing here argues for a choice. Keep this file in step with the code: when a
decision changes, change it here in the same piece of work.

Code: `app/study.tsx` (page), `components/sections/study*.ts` (design, session,
text, colors, data), `components/sections/StudyMap.tsx` +
`studyDotMap/` (map). Debug page: `app/study-debug.tsx`.

## Session structure

- Stages, one per variable, never interleaved. Stage order is shuffled per
  participant.
- Each stage has three blocks (tasks), order shuffled per stage: single-species,
  comparison, impression.
- 8 trials per block, so 40 trials per stage and 120 per session.
- Conditions (colormap x bounds): thematic | neutral, crossed with observed |
  global. Every block uses each of the four cells twice.
- No species appears twice in a session.
- Everything is seeded by the participant id (`seed` is logged), so a session can
  be rebuilt from it.
- URL params for piloting: `?variables=bio1,bio12`, `?tasks=single|compare|impression`.
- Justification: _to be written_

## Variables (stages)

| Stage variable | Id | Units shown | Control |
|---|---|---|---|
| Annual mean temperature | `bio1` | °F | no |
| Annual precipitation | `bio12` | in | no |
| Mean solar radiation (CHELSA `rsdsmean`; replaced `direct_sun`, which replaced `terrain_shade`) | `rsdsmean` | W m⁻² | no |
| Snow cover duration (MODIS `scdur`) | `scdur` | days | no |
| Coarse fragments in the soil (SoilGrids `cfvo`) | `cfvo` | % | yes (no thematic association) |

- Justification: _to be written_

## Colormaps

- Thematic vs neutral, per variable. Bounds: observed (species' displayed range)
  vs global (catalog render min/max).
- Legend shows the species' observed min/max (`legendRange='observed'`); the
  legend is hidden until the map is ready.

| Variable | Thematic | Neutral |
|---|---|---|
| `bio1` | coolwarm (blue to red) | viridis |
| `bio12` | `#72005e` to `#4dc7e8` (Schloss lab pair, water association 0.06 to 0.86, lightness span 50) | `#72005e` to `#f1a78a` (water association 0.06 to 0.05, lightness span 50) |
| `rsdsmean` | `#000000` to `#fcdb42` (Schloss lab pair, sunshine association 0.01 to 0.93, lightness span 88) | `#000000` to `#73f5b0` (sunshine association 0.01 to 0.34, lightness span 88) |
| `scdur` | brown to white | viridis |
| `cfvo` (control) | pale pink `#fde0dd` to purple `#7a0177` (arbitrary) | viridis |

- The Schloss pairs come from `SchlossVRL/assign-infer-colormaps`
  (`allSunshinePairs.csv`, `allWaterPairs.csv`). Interpolation between the two
  endpoints is linear in RGB (the paper's own interpolation was not used).
- Neutral pair chosen at the same lightness span as the thematic pair, with the
  weakest association at the light end at that span (sunshine) or the weakest
  association at both ends (water, same dark end as the thematic pair).
- Justification: _to be written_

## Map and crop

- Dedicated study map (`StudyDotMap`): flat Mercator MapLibre, raster basemap,
  dots drawn on a canvas.
- Species table: 2,000 to 5,000 observations (not obscured, coordinate
  uncertainty at most 500 m); species kept when at most 1% of observations fall
  outside one 800x480 px window at zoom 4 (`viewBox`). Only observations inside
  the window are displayed, scored, and used for observed bounds. 1,361 species.
- Observations with no value for the variable are not shown.
- Map height follows the window height (window height minus 300 px, minimum 480).
- Timer starts only when the block intro is dismissed and every map in the trial
  is drawn and settled (15 s timeout; unverified maps are logged as
  `mapsVerified: false`).
- Justification: _to be written_

## Task 1: single species

- Prompt: find the highest or lowest observation for the variable (per-variable
  wording in `studyVariables.ts`). Click the dot, then Next.
- Pool: species whose spread (max minus min of displayed values) is in the top
  quartile for the variable and which have at least 1,500 displayed values.
- Species spread across spatial-entropy quartiles (two per quartile per round of
  4); highest/lowest balanced 4/4 per block.
- Correct answer: the displayed observation with the extreme value. Logged:
  selected observation, truth, value difference, distance in km.
- Justification: _to be written_

## Task 2: comparison

- Prompt: which of two species' observations has the higher average value. Two
  maps side by side; F = Map A, J = Map B; submits immediately.
- A pair qualifies when: means differ by 2 to 3 standard deviations of the
  species means (per variable); spreads within 0.25 x the variable's median
  spread; entropy gap at most 0.12; observation counts within a factor of 2;
  different genus; observation mean and occupied-cell mean agree on the higher
  species (cell-mean gap at least half the mean gap).
- Adversarial pairs, always (every comparison trial, all four conditions): the
  species with the lower mean has its mean sitting higher within its own
  min-max range (`relativeMean` = (mean - min) / (max - min) of its displayed
  values) than the higher-mean species does, by at least `ADVERSARIAL_MARGIN`
  (currently 0.05). With observed bounds, the lower-mean species therefore
  tends to look "hotter/wetter/..." than the other. Decision: all pairs are
  adversarial, so the skew is controlled and does not vary across trials.
- Logged per comparison trial: `design.relativeMean` for each map.
- Observed feasibility (matching constraints above plus the margin 0.05, over the
  1,361 study species with at least 1,500 values): pairs remaining after all
  filters: `bio1` 2,134; `rsdsmean` 947; `bio12` 78; `cfvo` 4; `scdur` 0. Pairs
  that satisfy only the mean-difference and adversarial rules: `scdur` 54,
  `cfvo` 2,786.
- Correct answer: the species with the higher mean over displayed observations.
- Higher species on the left in half the trials.
- Justification: _to be written_

## Task 3: impression

- Prompt: "Can this species tolerate <condition>?" Yes/No. F = Yes, J = No (or
  click). Dot popups are disabled for this task (so exact values cannot be read).
- Wording per variable:

| Variable | High end | Low end |
|---|---|---|
| `bio1` | hot conditions | cold conditions |
| `bio12` | wet conditions | dry conditions |
| `rsdsmean` | very bright, sunny conditions | dim, cloudy conditions |
| `scdur` | long, snowy winters | snow-free winters |
| `cfvo` | rocky soil | fine, non-rocky soil |

- Per block: 4 high-end and 4 low-end questions, 4 yes and 4 no (shuffled
  independently), 2 trials per condition cell. Species spread across
  spatial-entropy quartiles where possible.
- Pool: every species in the study table with at least 1,500 displayed values
  (not restricted to the high-spread pool).

### Ground truth (default rule: percentile)

- Each species' practical extremes are its 1st (low end) and 99th (high end)
  percentile of the variable, over all its quality-filtered observations
  (not obscured, coordinate uncertainty at most 500 m), not cropped to the map
  window.
- Those extremes are ranked across all plant species with at least 10 such values
  for the variable (about 75,900 species; 73,200 for `cfvo`). Ties share their
  mid-rank.
- Tolerance percentile (0 to 1, higher = more tolerant): low end = 1 minus the
  percentile of its 1st-percentile value (lower value = more tolerant); high end
  = percentile of its 99th-percentile value.
- Yes: tolerance percentile at least 0.6. No: at most 0.4. Species between are
  never used.
- Generated data: `components/sections/studyStageExtremes.ts` (values in display
  units: °F, in).
- Justification: _to be written_

### Ground truth (exception: `scdur`, low end, "snow-free winters")

- Yes: 1st percentile of snow-cover days is 0. No: 1st percentile is 30 days or
  more. Between is never used.
- Reason this rule differs (as observed, not a justification of the thresholds):
  1,092 of the 1,361 study species have a 1st percentile of exactly 0, which ties;
  under the percentile rule 162 of the 269 "no" species had under 7 days.
- Logged as `groundTruthRule: 'absolute-days'` (other trials: `'percentile'`).
- Justification: _to be written_

## Logged per response

`participantId, mode ('session'), task, trialIndex, stage, stageCount,
blockIndex, indexInBlock, species, variable, isControl, units, conditions
(colormap, bounds), design, question, answer, timing {startedAt, mapsVerified,
timeToFirstClickMs, timeToFinalClickMs, elapsedMs}, clicks, choices`.

- `question.id`: `habitat-extreme` (single), `which-higher-on-average`
  (comparison), `can-tolerate` (impression, with `pole`).
- Impression answer: `{saidYes, canTolerate, correct, pole, tolerancePercentile,
  extremeValue}`. `design` also holds `speciesMean` and `groundTruthRule`.
- Comparison answer: `{choice, higherIndex, correct, means, cellMeans, diff}`.

## Open items

- Adversarial comparison pairs cannot fill a block for `scdur` (none) or `cfvo`
  (4 pairs) with the current matching constraints; `bio12` has 78. The
  comparison blocks for those variables come out short or empty until the rule
  or the matching constraints are changed.

- Legend shows the observed min/max, which can serve as an answer key in the
  comparison and single-species tasks; undecided whether to delay or remove it.
- Selection thresholds above (top-quartile spread, 2 to 3 SD pairs, 0.25 x median
  spread, entropy gap, count ratio, adversarial margin 0.05, 0.6/0.4 cutoffs, 10-value minimum for the
  ranking pool, 30-day snow cutoff) are working defaults.
- Popups remain enabled in the single-species and comparison tasks.
- Browser verification of the full session flow has not been done.
