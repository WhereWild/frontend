// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Participant-facing wording for the study: per-trial questions and the intro
// shown before each block.

import type { StudyTrial } from '@/components/sections/studyTrials';
import {
  getStudyVariable,
  type StudyVariable,
} from '@/components/sections/studyVariables';

export const questionText = (trial: StudyTrial): string => {
  const variable = getStudyVariable(trial.variableId);
  if (trial.question.kind === 'compare') {
    return `Which species' observations have the higher average ${variable.average}? Press F for Map A or J for Map B.`;
  }
  if (trial.question.kind === 'impression') {
    return `Can this species tolerate ${variable.tolerance[trial.question.pole]}? Press F for Yes or J for No.`;
  }
  return `${variable.extremePrompt[trial.question.target]} Click that dot on the map.`;
};

export const introText = (
  trial: StudyTrial,
  variable: StudyVariable = getStudyVariable(trial.variableId),
): { heading: string; lines: string[] } => ({
  heading: `Stage ${trial.stage + 1} of ${trial.stageCount}: ${variable.title}`,
  lines:
    trial.task === 'impression'
      ? [
          `The map shows where one species was observed, colored by ${variable.average}.`,
          'Judging from where it was observed, decide whether the species can tolerate the condition you are asked about.',
          'Press F for Yes, J for No. Answer as quickly as you can while staying accurate.',
          `${trial.blockLength} species.`,
        ]
      : trial.task === 'compare'
        ? [
            `Each map shows where one species was observed, colored by ${variable.average}.`,
            `For each pair, decide which species' observations have the higher average ${variable.average}.`,
            'Press F if Map A is higher, J if Map B is higher. Answer as quickly as you can while staying accurate.',
            `${trial.blockLength} pairs.`,
          ]
        : [
            `The map shows where one species was observed, colored by ${variable.average}.`,
            'Each time, you will be asked to find the observation where the value is highest or lowest. Click that dot, then press Next.',
            `${trial.blockLength} species.`,
          ],
});
