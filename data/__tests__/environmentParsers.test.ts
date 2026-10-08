// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseSpeciesEnvironmentStats } from '../environmentParsers';

describe('parseSpeciesEnvironmentStats', () => {
  it('parses minimal all_obscured payloads from the backend fallback response', () => {
    const result = parseSpeciesEnvironmentStats(
      {
        all_obscured: true,
        speciesId: 42,
        variable: 'bio_1',
      },
      42,
      'bio_1',
    );

    expect(result).toEqual(
      expect.objectContaining({
        speciesId: 42,
        variable: 'bio_1',
        variableName: 'bio_1',
        allObscured: true,
        observationCount: 0,
        summary: expect.objectContaining({ count: 0 }),
      }),
    );
  });

  it('parses camelCase allObscured and variable metadata fields', () => {
    const result = parseSpeciesEnvironmentStats(
      {
        allObscured: true,
        species_id: 7,
        variable: 'landcover',
        variable_metadata: {
          name: 'Land Cover',
          units: null,
          valueType: 'categorical',
        },
      },
      7,
      'landcover',
    );

    expect(result.allObscured).toBe(true);
    expect(result.speciesId).toBe(7);
    expect(result.variableName).toBe('Land Cover');
    expect(result.variableType).toBe('categorical');
  });
});

describe('parseSpeciesEnvironmentStats relative ranks', () => {
  it('keeps the cohort identity and display value needed to fetch a rank density', () => {
    const result = parseSpeciesEnvironmentStats(
      {
        speciesId: 42,
        variable: 'bio1',
        summary: { count: 10 },
        relative_ranks: [
          {
            metric: 'mean',
            position: 3,
            count: 40,
            percentile: 0.075,
            context_label: 'Opuntia',
            label: 'Opuntia',
            context_taxon_id: '2923968',
            context_rank: 'SPECIES',
            variable: 'bio1',
            value: 61.5,
          },
        ],
      },
      42,
      'bio1',
    );

    expect(result.relativeRanks?.[0]).toEqual(
      expect.objectContaining({
        metric: 'mean',
        rank: 3,
        contextTaxonId: '2923968',
        contextRank: 'SPECIES',
        variable: 'bio1',
        value: 61.5,
      }),
    );
  });
});
