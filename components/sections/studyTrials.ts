// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { StudyScheme } from '@/components/sections/studyColors';
import { buildComparisonTrials } from '@/components/sections/studyCompare';
import { buildTrials, schemeFor } from '@/components/sections/studyDesign';
import type { StudyViewBox } from '@/components/sections/studyPool';
import type { ExtremeTarget } from '@/components/sections/studyScoring';

export type StudySpecies = {
  taxonId: string;
  label: string;
  viewBox: StudyViewBox;
};

export type StudyQuestion =
  | { kind: 'extreme'; target: ExtremeTarget }
  | {
      kind: 'compare';
      /** Index into the trial's species of the one with the higher mean. */
      hotterIndex: 0 | 1;
      meansF: [number, number];
      cellMeansF: [number, number];
    };

export type StudyTrial = {
  species: StudySpecies[];
  question: StudyQuestion;
  scheme: StudyScheme;
  /** Logged with the response (what the design assigned this trial). */
  design: Record<string, unknown>;
};

/** Single-species trials: click the hottest/coldest dot. */
export const singleSpeciesTrials = (participantId: string): StudyTrial[] =>
  buildTrials(participantId).map((t) => ({
    species: [
      {
        taxonId: t.species.id,
        label: t.species.name,
        viewBox: t.species.viewBox,
      },
    ],
    question: { kind: 'extreme', target: t.target },
    scheme: schemeFor(t.condition),
    design: {
      seed: participantId,
      condition: t.condition,
      entropy: t.species.entropy,
      entropyQuartile: t.species.q,
      spreadF: t.species.spreadF,
      poolObservationCount: t.species.n,
      viewBox: t.species.viewBox,
    },
  }));

/** Comparison trials: which of two species is hotter on average. */
export const comparisonTrials = (participantId: string): StudyTrial[] =>
  buildComparisonTrials(participantId).map((t) => {
    const [left, right] = t.species;
    return {
      species: t.species.map((s) => ({
        taxonId: s.id,
        label: s.name,
        viewBox: s.viewBox,
      })),
      question: {
        kind: 'compare',
        hotterIndex: t.hotterIndex,
        meansF: [left.meanF, right.meanF],
        cellMeansF: [left.cellMeanF, right.cellMeanF],
      },
      scheme: schemeFor(t.condition),
      design: {
        seed: participantId,
        condition: t.condition,
        spreadF: [left.spreadF, right.spreadF],
        entropy: [left.entropy, right.entropy],
        poolObservationCount: [left.n, right.n],
        viewBoxes: [left.viewBox, right.viewBox],
      },
    };
  });
