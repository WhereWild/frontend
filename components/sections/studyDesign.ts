// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Per-participant trial design for the visualization study: STUDY_ROUNDS
// rounds of 4 trials, every trial on a different species drawn at random from
// the pool, each round using one species from each entropy quartile (so spatial dispersion is evenly sampled and logged, not varied
// as a factor). The 4 conditions are the 2x2 of colormap (viridis vs
// coolwarm) x bounds (the species' own observed range vs the variable's
// global range), each used exactly once per participant; which condition
// lands on which species, the hottest/coldest question (2 of each per round)
// and the trial order are all randomized. Seeded by the participant id, so a design
// can be reproduced from the logged id alone.

import type { StudyScheme } from '@/components/sections/studyColors';
import { STUDY_POOL, type PoolSpecies } from '@/components/sections/studyPool';
import type { ExtremeTarget } from '@/components/sections/studyScoring';

/** Rounds of 4 trials per participant (10 -> 40 trials, 40 species). */
export const STUDY_ROUNDS = 10;

export type StudyCondition = {
  colormap: 'viridis' | 'coolwarm';
  bounds: 'observed' | 'global';
};

export const STUDY_CONDITIONS: StudyCondition[] = [
  { colormap: 'viridis', bounds: 'observed' },
  { colormap: 'viridis', bounds: 'global' },
  { colormap: 'coolwarm', bounds: 'observed' },
  { colormap: 'coolwarm', bounds: 'global' },
];

/** Everything the 2x2 holds constant. */
const BASE_SCHEME = {
  observedLumSat: false,
  distributionAware: false,
  center: 'none',
  lumSatChannels: 'both',
  lumSatShape: 'sequential',
} as const;

export const schemeFor = (condition: StudyCondition): StudyScheme => ({
  ...BASE_SCHEME,
  ...condition,
});

export type DesignedTrial = {
  species: PoolSpecies;
  condition: StudyCondition;
  target: ExtremeTarget;
};

// xmur3 string hash -> mulberry32 PRNG: small, deterministic, seedable.
export const seededRandom = (seed: string) => {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a =
    (Math.imul(h ^ (h >>> 16), 2246822507) ^
      Math.imul(h ^ (h >>> 13), 3266489909)) >>>
    0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const shuffled = <T>(items: readonly T[], random: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const buildTrials = (
  participantId: string,
  rounds: number = STUDY_ROUNDS,
  pool: readonly PoolSpecies[] = STUDY_POOL,
): DesignedTrial[] => {
  const random = seededRandom(participantId);
  // Per quartile, `rounds` distinct species (sampling without replacement).
  const byQuartile = ([1, 2, 3, 4] as const).map((q) =>
    shuffled(
      pool.filter((s) => s.q === q),
      random,
    ).slice(0, rounds),
  );
  const trials: DesignedTrial[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const conditions = shuffled(STUDY_CONDITIONS, random);
    const targets = shuffled<ExtremeTarget>(
      ['hottest', 'hottest', 'coldest', 'coldest'],
      random,
    );
    byQuartile.forEach((stratum, i) => {
      if (stratum[round]) {
        trials.push({
          species: stratum[round],
          condition: conditions[i],
          target: targets[i],
        });
      }
    });
  }
  return shuffled(trials, random);
};
