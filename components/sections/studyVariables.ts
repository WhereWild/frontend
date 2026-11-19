// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// The variables the visualization study runs through, one stage each, and the
// wording of the three tasks for each. `cfvo` (coarse fragments in the soil) is
// the control: a variable with no everyday color metaphor.

export type StudyVariableId = 'bio1' | 'bio12' | 'rsdsmean' | 'scdur' | 'cfvo';

export type StudyVariable = {
  id: StudyVariableId;
  /** Shown as the stage heading. */
  title: string;
  /** True for the control variable (no thematic color association). */
  isControl: boolean;
  /** Single-species task prompts for the highest / lowest value. */
  extremePrompt: { highest: string; lowest: string };
  /** Noun phrase for the comparison task: "...the higher average <this>". */
  average: string;
  /** Impression task: what the species is asked about tolerating, at the
   * variable's high and low ends ("can this species tolerate <this>?"). */
  tolerance: { high: string; low: string };
};

export const STUDY_VARIABLES: StudyVariable[] = [
  {
    id: 'bio1',
    title: 'Annual mean temperature',
    isControl: false,
    extremePrompt: {
      highest: "Where is this species' habitat the hottest?",
      lowest: "Where is this species' habitat the coldest?",
    },
    average: 'annual mean temperature',
    tolerance: { high: 'hot conditions', low: 'cold conditions' },
  },
  {
    id: 'bio12',
    title: 'Annual precipitation',
    isControl: false,
    extremePrompt: {
      highest: "Where is this species' habitat the wettest?",
      lowest: "Where is this species' habitat the driest?",
    },
    average: 'annual precipitation',
    tolerance: { high: 'wet conditions', low: 'dry conditions' },
  },
  {
    id: 'rsdsmean',
    title: 'Solar radiation',
    isControl: false,
    extremePrompt: {
      highest: "Where is this species' habitat the sunniest?",
      lowest: "Where is this species' habitat the least sunny?",
    },
    average: 'solar radiation',
    tolerance: {
      high: 'very bright, sunny conditions',
      low: 'dim, cloudy conditions',
    },
  },
  {
    id: 'scdur',
    title: 'Snow cover duration',
    isControl: false,
    extremePrompt: {
      highest: "Where is this species' habitat the snowiest?",
      lowest: "Where is this species' habitat the least snowy?",
    },
    average: 'snow cover duration',
    tolerance: { high: 'long, snowy winters', low: 'snow-free winters' },
  },
  {
    id: 'cfvo',
    title: 'Coarse fragments in the soil',
    isControl: true,
    extremePrompt: {
      highest:
        "Where is this species' soil the rockiest (most coarse fragments)?",
      lowest:
        "Where is this species' soil the least rocky (fewest coarse fragments)?",
    },
    average: 'coarse-fragment content of the soil',
    tolerance: { high: 'rocky soil', low: 'fine, non-rocky soil' },
  },
];

export const getStudyVariable = (id: StudyVariableId): StudyVariable => {
  const found = STUDY_VARIABLES.find((v) => v.id === id);
  if (!found) throw new Error(`Unknown study variable ${id}`);
  return found;
};
