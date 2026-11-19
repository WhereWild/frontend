// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Shared pieces of the study design: the 2x2 conditions (colormap x bounds) and
// a seeded random source, so a participant's whole session can be reproduced
// from the logged participant id alone. The session itself is built in
// studySession.ts.

import type { StudyScheme } from '@/components/sections/studyColors';

/** `thematic`: the variable's own metaphor ramp; `neutral`: viridis for every
 * variable. `observed`: the colormap spans the species' own displayed range;
 * `global`: it spans the variable's full global range. */
export type StudyCondition = {
  colormap: 'thematic' | 'neutral';
  bounds: 'observed' | 'global';
};

export const STUDY_CONDITIONS: StudyCondition[] = [
  { colormap: 'neutral', bounds: 'observed' },
  { colormap: 'neutral', bounds: 'global' },
  { colormap: 'thematic', bounds: 'observed' },
  { colormap: 'thematic', bounds: 'global' },
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
