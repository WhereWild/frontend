// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { StudyScheme } from '@/components/sections/studyColors';
import type { StudyViewBox } from '@/components/sections/studyStageData';
import type { ExtremeTarget } from '@/components/sections/studyScoring';
import type { StudyVariableId } from '@/components/sections/studyVariables';

export type StudySpecies = {
  taxonId: string;
  label: string;
  viewBox: StudyViewBox;
};

export type StudyTask = 'single' | 'compare' | 'impression';

export type StudyQuestion =
  | { kind: 'extreme'; target: ExtremeTarget }
  | {
      /** "Can this species tolerate <the variable's high/low end>?" (yes/no).
       * Yes when the species' own extreme on that side (1st percentile for
       * 'low', 99th for 'high') is among the most extreme of all species. */
      kind: 'impression';
      pole: 'high' | 'low';
      canTolerate: boolean;
      /** The species' tolerance percentile (0-1, higher = more tolerant) and
       * the extreme value it comes from. */
      tolerancePercentile: number;
      extremeValue: number;
    }
  | {
      kind: 'compare';
      /** Index into the trial's species of the one with the higher mean. */
      higherIndex: 0 | 1;
      /** Mean of the variable over each species' displayed observations. */
      means: [number, number];
      /** Same, averaged over occupied map cells. */
      cellMeans: [number, number];
    };

/** One trial of a session. A session is stages (one variable each, in random
 * order); each stage has three blocks (single-species, comparison and impression,
 * in random order) of equal length. */
export type StudyTrial = {
  variableId: StudyVariableId;
  /** 0-based stage (variable) and block (stage x task) positions. */
  stage: number;
  stageCount: number;
  blockIndex: number;
  blockCount: number;
  /** Position within the block (0-based) and the block's length. */
  indexInBlock: number;
  blockLength: number;
  task: StudyTask;
  species: StudySpecies[];
  question: StudyQuestion;
  scheme: StudyScheme;
  /** Logged with the response (what the design assigned this trial). */
  design: Record<string, unknown>;
};
