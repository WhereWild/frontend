// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Builds a participant's whole study session. Stages, one per variable, run in
// random order (never interleaved). Each stage has three tasks as separate
// blocks, in random order: the single-species task (find the highest/lowest
// observation), the comparison task (which of two species has the higher
// average) and the impression task (can this species tolerate the variable's
// high or low end: yes/no, scored against the species' own extreme). Every block has TRIALS_PER_BLOCK trials, the four conditions
// (neutral/thematic colormap x observed/global bounds) used equally often, and
// no species appears twice in a session. Seeded by the participant id, so the
// whole session can be reproduced from the logged id.

import {
  schemeFor,
  seededRandom,
  shuffled,
  STUDY_CONDITIONS,
  type StudyCondition,
} from '@/components/sections/studyDesign';
import { STAGE_EXTREMES } from '@/components/sections/studyStageExtremes';
import {
  STAGE_SPECIES,
  VARIABLE_POPULATION,
  type StageSpecies,
} from '@/components/sections/studyStageData';
import type { ExtremeTarget } from '@/components/sections/studyScoring';
import type {
  StudySpecies,
  StudyTask,
  StudyTrial,
} from '@/components/sections/studyTrials';
import {
  STUDY_VARIABLES,
  type StudyVariableId,
} from '@/components/sections/studyVariables';

/** Trials per block (a multiple of 4: two per condition cell for 8). */
export const TRIALS_PER_BLOCK = 8;

/** Minimum displayed observations with a value for a species to be used. */
const MIN_VALUES = 1500;

// Comparison pairs: the means differ by DIFF_SD_MIN..DIFF_SD_MAX standard
// deviations of the species means (the "largest difference" level); the
// spreads differ by at most SPREAD_TOLERANCE x the median spread, entropy by at
// most MAX_ENTROPY_GAP and observation counts by at most MAX_N_RATIO, so only
// the mean differs; never the same genus; and the observation mean and the
// occupied-cell mean must agree on which species is higher.
const DIFF_SD_MIN = 2;
const DIFF_SD_MAX = 3;
const SPREAD_TOLERANCE = 0.25;
const MAX_ENTROPY_GAP = 0.12;
const MAX_N_RATIO = 2;
// Adversarial pairs: with each species colored on its own observed range, the
// species with the LOWER mean has its observations crowded higher in its own
// range than the other has in its own, so it looks hotter/wetter/... on the
// map. relativeMean (mean's position within the species' min-max, 0..1) of the
// lower-mean species must exceed the higher-mean species' by at least this.
const ADVERSARIAL_MARGIN = 0.05;

export type SessionOptions = {
  /** Restrict to these variables (default: all, in random stage order). */
  variables?: StudyVariableId[];
  /** Restrict to these tasks (default: both, in random order per stage). */
  tasks?: StudyTask[];
  trialsPerBlock?: number;
};

const toStudySpecies = (s: StageSpecies): StudySpecies => ({
  taxonId: s.id,
  label: s.name,
  viewBox: s.viewBox,
});

type BlockTrial = Omit<
  StudyTrial,
  | 'stage'
  | 'stageCount'
  | 'blockIndex'
  | 'blockCount'
  | 'indexInBlock'
  | 'blockLength'
>;

const singleBlock = (
  variableId: StudyVariableId,
  count: number,
  random: () => number,
  used: Set<string>,
): BlockTrial[] => {
  const population = VARIABLE_POPULATION[variableId];
  // "Very wide" species for this variable: spread in the top quartile.
  const pool = STAGE_SPECIES.filter((s) => {
    const stats = s.stats[variableId];
    return (
      stats &&
      stats.nv >= MIN_VALUES &&
      stats.spread >= population.spreadP75 &&
      !used.has(s.id)
    );
  }).sort((a, b) => a.entropy - b.entropy);
  // Entropy quartiles of the pool, so spatial dispersion is evenly sampled.
  const quartiles = [0, 1, 2, 3].map((q) =>
    shuffled(
      pool.filter((_, i) => Math.floor((4 * i) / pool.length) === q),
      random,
    ),
  );
  const rounds = Math.ceil(count / 4);
  const trials: BlockTrial[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const conditions = shuffled(STUDY_CONDITIONS, random);
    const targets = shuffled<ExtremeTarget>(
      ['highest', 'highest', 'lowest', 'lowest'],
      random,
    );
    quartiles.forEach((stratum, q) => {
      const species = stratum[round];
      if (!species || trials.length >= count) return;
      used.add(species.id);
      const stats = species.stats[variableId];
      trials.push({
        variableId,
        task: 'single',
        species: [toStudySpecies(species)],
        question: { kind: 'extreme', target: targets[q] },
        scheme: schemeFor(conditions[q]),
        design: {
          condition: conditions[q],
          entropy: species.entropy,
          entropyQuartile: q + 1,
          spread: stats?.spread,
          valueCount: stats?.nv,
          poolObservationCount: species.n,
          viewBox: species.viewBox,
        },
      });
    });
  }
  return shuffled(trials, random);
};

const isValidPair = (
  variableId: StudyVariableId,
  a: StageSpecies,
  b: StageSpecies,
) => {
  const sa = a.stats[variableId];
  const sb = b.stats[variableId];
  if (!sa || !sb) return false;
  const population = VARIABLE_POPULATION[variableId];
  const diff = Math.abs(sa.mean - sb.mean);
  if (
    diff < DIFF_SD_MIN * population.sdMeans ||
    diff >= DIFF_SD_MAX * population.sdMeans
  ) {
    return false;
  }
  if (
    Math.abs(sa.spread - sb.spread) >
    SPREAD_TOLERANCE * population.spreadMedian
  ) {
    return false;
  }
  if (Math.abs(a.entropy - b.entropy) > MAX_ENTROPY_GAP) return false;
  if (Math.max(a.n, b.n) / Math.min(a.n, b.n) > MAX_N_RATIO) return false;
  if (a.name.split(' ')[0] === b.name.split(' ')[0]) return false;
  if (sa.relativeMean == null || sb.relativeMean == null) return false;
  const [lowerStats, higherStats] = sa.mean < sb.mean ? [sa, sb] : [sb, sa];
  if (
    (lowerStats.relativeMean ?? 0) - (higherStats.relativeMean ?? 0) <
    ADVERSARIAL_MARGIN
  ) {
    return false;
  }
  const meanGap = sa.mean - sb.mean;
  const cellGap = sa.cellMean - sb.cellMean;
  return meanGap * cellGap > 0 && Math.abs(cellGap) >= 0.5 * Math.abs(meanGap);
};

const compareBlock = (
  variableId: StudyVariableId,
  count: number,
  random: () => number,
  used: Set<string>,
): BlockTrial[] => {
  const order = shuffled(
    STAGE_SPECIES.filter((s) => {
      const stats = s.stats[variableId];
      return stats && stats.nv >= MIN_VALUES && !used.has(s.id);
    }),
    random,
  );
  const pairs: { high: StageSpecies; low: StageSpecies }[] = [];
  const taken = new Set<string>();
  for (const a of order) {
    if (pairs.length >= count) break;
    if (taken.has(a.id)) continue;
    const partners = order.filter(
      (b) => !taken.has(b.id) && b.id !== a.id && isValidPair(variableId, a, b),
    );
    if (partners.length === 0) continue;
    const b = partners[Math.floor(random() * partners.length)];
    taken.add(a.id);
    taken.add(b.id);
    const meanA = a.stats[variableId]?.mean ?? 0;
    const meanB = b.stats[variableId]?.mean ?? 0;
    pairs.push(meanA > meanB ? { high: a, low: b } : { high: b, low: a });
  }
  taken.forEach((id) => used.add(id));

  const trials: BlockTrial[] = [];
  for (let start = 0; start < pairs.length; start += 4) {
    const block = pairs.slice(start, start + 4);
    const conditions: StudyCondition[] = shuffled(STUDY_CONDITIONS, random);
    const higherIndexes = shuffled<0 | 1>([0, 0, 1, 1], random);
    block.forEach((pair, i) => {
      const higherIndex = higherIndexes[i];
      const [left, right] =
        higherIndex === 0 ? [pair.high, pair.low] : [pair.low, pair.high];
      const ls = left.stats[variableId];
      const rs = right.stats[variableId];
      trials.push({
        variableId,
        task: 'compare',
        species: [toStudySpecies(left), toStudySpecies(right)],
        question: {
          kind: 'compare',
          higherIndex,
          means: [ls?.mean ?? 0, rs?.mean ?? 0],
          cellMeans: [ls?.cellMean ?? 0, rs?.cellMean ?? 0],
        },
        scheme: schemeFor(conditions[i]),
        design: {
          condition: conditions[i],
          entropy: [left.entropy, right.entropy],
          spread: [ls?.spread, rs?.spread],
          relativeMean: [ls?.relativeMean, rs?.relativeMean],
          valueCount: [ls?.nv, rs?.nv],
          poolObservationCount: [left.n, right.n],
          viewBoxes: [left.viewBox, right.viewBox],
        },
      });
    });
  }
  return shuffled(trials, random);
};

// Impression task ground truth: a species' tolerance percentile (0-1, higher =
// more tolerant) of the variable's low or high end, ranked against every plant
// species (studyStageExtremes.ts). A species is "yes" at >= TOLERANT_FROM and
// "no" at <= INTOLERANT_UNTIL; the middle is never used, so every answer has a
// clear ground truth without needing extreme tails.
const TOLERANT_FROM = 0.6;
const INTOLERANT_UNTIL = 0.4;

// Exception: the snow-duration low end ("snow-free winters"). Most species'
// 1st percentile is exactly 0 days, a huge tie, so a percentile rule would
// call a species with 0.3 days "no" and one with 0 "yes". There the answer is
// defined on the days themselves: yes at <= SNOW_FREE_YES_AT_MOST (literally
// snow-free), no at >= SNOW_FREE_NO_AT_LEAST (snow cover everywhere it occurs
// for at least a month), nothing in between. See docs/study-ground-truth.md.
const SNOW_FREE_YES_AT_MOST = 0;
const SNOW_FREE_NO_AT_LEAST = 30;

const isTolerant = (
  variableId: StudyVariableId,
  pole: 'low' | 'high',
  tolerance: Tolerance,
  wantTolerant: boolean,
): boolean => {
  if (variableId === 'scdur' && pole === 'low') {
    return wantTolerant
      ? tolerance.lowValue <= SNOW_FREE_YES_AT_MOST
      : tolerance.lowValue >= SNOW_FREE_NO_AT_LEAST;
  }
  const t = tolerance[pole];
  return wantTolerant ? t >= TOLERANT_FROM : t <= INTOLERANT_UNTIL;
};

type Tolerance = {
  low: number;
  high: number;
  lowValue: number;
  highValue: number;
};

const tolerancesFor = (variableId: StudyVariableId): Map<string, Tolerance> => {
  const result = new Map<string, Tolerance>();
  STAGE_SPECIES.forEach((s) => {
    const stats = s.stats[variableId];
    const extremes = STAGE_EXTREMES[s.id]?.[variableId];
    if (stats && stats.nv >= MIN_VALUES && extremes) {
      result.set(s.id, {
        low: extremes.lowTolerance,
        high: extremes.highTolerance,
        lowValue: extremes.low,
        highValue: extremes.high,
      });
    }
  });
  return result;
};

const impressionBlock = (
  variableId: StudyVariableId,
  count: number,
  random: () => number,
  used: Set<string>,
): BlockTrial[] => {
  const tolerances = tolerancesFor(variableId);
  const pool = STAGE_SPECIES.filter(
    (s) => tolerances.has(s.id) && !used.has(s.id),
  ).sort((a, b) => a.entropy - b.entropy);
  const quartileOf = new Map(
    pool.map((s, i) => [s.id, Math.floor((4 * i) / pool.length)]),
  );
  const rounds = Math.ceil(count / 4);
  const trials: BlockTrial[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const conditions = shuffled(STUDY_CONDITIONS, random);
    const poles = shuffled<'low' | 'high'>(
      ['low', 'low', 'high', 'high'],
      random,
    );
    const truths = shuffled([true, true, false, false], random);
    for (let q = 0; q < 4 && trials.length < count; q += 1) {
      const pole = poles[q];
      const fits = pool.filter((s) => {
        if (used.has(s.id)) return false;
        return isTolerant(variableId, pole, tolerances.get(s.id)!, truths[q]);
      });
      const inQuartile = fits.filter((s) => quartileOf.get(s.id) === q);
      const choices = inQuartile.length ? inQuartile : fits;
      if (!choices.length) continue;
      const species = choices[Math.floor(random() * choices.length)];
      used.add(species.id);
      const tolerance = tolerances.get(species.id)!;
      const stats = species.stats[variableId];
      trials.push({
        variableId,
        task: 'impression',
        species: [toStudySpecies(species)],
        question: {
          kind: 'impression',
          pole,
          canTolerate: truths[q],
          tolerancePercentile: tolerance[pole],
          extremeValue:
            pole === 'low' ? tolerance.lowValue : tolerance.highValue,
        },
        scheme: schemeFor(conditions[q]),
        design: {
          condition: conditions[q],
          entropy: species.entropy,
          entropyQuartile: (quartileOf.get(species.id) ?? 0) + 1,
          speciesMean: stats?.mean,
          groundTruthRule:
            variableId === 'scdur' && pole === 'low'
              ? 'absolute-days'
              : 'percentile',
          valueCount: stats?.nv,
          poolObservationCount: species.n,
          viewBox: species.viewBox,
        },
      });
    }
  }
  return shuffled(trials, random);
};

export const buildSession = (
  participantId: string,
  options: SessionOptions = {},
): StudyTrial[] => {
  const random = seededRandom(`session:${participantId}`);
  const count = options.trialsPerBlock ?? TRIALS_PER_BLOCK;
  const variableIds = shuffled(
    options.variables ?? STUDY_VARIABLES.map((v) => v.id),
    random,
  );
  const taskChoices: StudyTask[] = options.tasks ?? [
    'single',
    'compare',
    'impression',
  ];
  const used = new Set<string>();
  const blocks: { variableId: StudyVariableId; trials: BlockTrial[] }[] = [];
  variableIds.forEach((variableId) => {
    shuffled(taskChoices, random).forEach((task) => {
      blocks.push({
        variableId,
        trials:
          task === 'single'
            ? singleBlock(variableId, count, random, used)
            : task === 'compare'
              ? compareBlock(variableId, count, random, used)
              : impressionBlock(variableId, count, random, used),
      });
    });
  });

  const session: StudyTrial[] = [];
  blocks.forEach((block, blockIndex) => {
    block.trials.forEach((trial, indexInBlock) => {
      session.push({
        ...trial,
        stage: variableIds.indexOf(block.variableId),
        stageCount: variableIds.length,
        blockIndex,
        blockCount: blocks.length,
        indexInBlock,
        blockLength: block.trials.length,
        design: { seed: participantId, ...trial.design },
      });
    });
  });
  return session;
};
