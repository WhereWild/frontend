// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Trial design for the comparison task: two species' maps side by side and the
// question "which species' observations have the higher average annual mean
// temperature?". Per participant, COMPARE_TRIALS trials, every species used at
// most once. Pairs differ in mean temperature by COMPARE_DIFF_F (the "how
// pronounced" knob - largest level for now) and are matched on spread, entropy
// and observation count so only the mean differs, never from the same genus,
// and only when the observation mean and the occupied-cell mean agree on which
// is hotter. Conditions (the same colormap x bounds 2x2 as the single-species
// task, applied to both maps) and which side holds the hotter species are
// balanced within blocks of 4 trials, then the order is shuffled. Seeded by the
// participant id.

import {
  COMPARE_POOL,
  type CompareSpecies,
} from '@/components/sections/studyComparePool';
import {
  STUDY_CONDITIONS,
  seededRandom,
  shuffled,
  type StudyCondition,
} from '@/components/sections/studyDesign';

/** 40 trials = 10 blocks of 4. */
export const COMPARE_TRIALS = 40;
/** |difference in mean temperature| range (F) for a pair. */
export const COMPARE_DIFF_F = { min: 20, max: 30 };

const MAX_SPREAD_GAP_F = 6;
const MAX_ENTROPY_GAP = 0.12;
const MAX_N_RATIO = 2;

const isValidPair = (a: CompareSpecies, b: CompareSpecies) => {
  const diff = Math.abs(a.meanF - b.meanF);
  if (diff < COMPARE_DIFF_F.min || diff >= COMPARE_DIFF_F.max) return false;
  if (Math.abs(a.spreadF - b.spreadF) > MAX_SPREAD_GAP_F) return false;
  if (Math.abs(a.entropy - b.entropy) > MAX_ENTROPY_GAP) return false;
  if (Math.max(a.n, b.n) / Math.min(a.n, b.n) > MAX_N_RATIO) return false;
  if (a.name.split(' ')[0] === b.name.split(' ')[0]) return false;
  const meanGap = a.meanF - b.meanF;
  const cellGap = a.cellMeanF - b.cellMeanF;
  return meanGap * cellGap > 0 && Math.abs(cellGap) >= 0.5 * Math.abs(meanGap);
};

export type ComparisonTrial = {
  /** Display order: [0] is the left/first map, [1] the right/second. */
  species: [CompareSpecies, CompareSpecies];
  /** Index (0 or 1) into `species` of the hotter one - the right answer. */
  hotterIndex: 0 | 1;
  condition: StudyCondition;
};

export const buildComparisonTrials = (
  participantId: string,
  count: number = COMPARE_TRIALS,
  pool: readonly CompareSpecies[] = COMPARE_POOL,
): ComparisonTrial[] => {
  const random = seededRandom(`compare:${participantId}`);
  const order = shuffled(pool, random);
  const used = new Set<string>();
  const pairs: { hot: CompareSpecies; cold: CompareSpecies }[] = [];
  for (const a of order) {
    if (pairs.length >= count) break;
    if (used.has(a.id)) continue;
    const partners = order.filter(
      (b) => !used.has(b.id) && b.id !== a.id && isValidPair(a, b),
    );
    if (partners.length === 0) continue;
    const b = partners[Math.floor(random() * partners.length)];
    used.add(a.id);
    used.add(b.id);
    pairs.push(a.meanF > b.meanF ? { hot: a, cold: b } : { hot: b, cold: a });
  }

  const trials: ComparisonTrial[] = [];
  for (let start = 0; start < pairs.length; start += 4) {
    const block = pairs.slice(start, start + 4);
    const conditions = shuffled(STUDY_CONDITIONS, random);
    const hotterIndexes = shuffled<0 | 1>([0, 0, 1, 1], random);
    block.forEach((pair, i) => {
      const hotterIndex = hotterIndexes[i];
      trials.push({
        species:
          hotterIndex === 0 ? [pair.hot, pair.cold] : [pair.cold, pair.hot],
        hotterIndex,
        condition: conditions[i],
      });
    });
  }
  return shuffled(trials, random);
};
