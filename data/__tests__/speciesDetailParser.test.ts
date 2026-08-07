// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { parseSpeciesApiDetail } from '../speciesDetailParser';
import type { SpeciesApiNormalized } from '../types';

const baseNormalized: SpeciesApiNormalized = {
  taxon_id: '99',
  scientific_name: 'Lynx canadensis',
  common_name: 'Canada Lynx',
  common_names: ['Canada Lynx'],
  image_source: 'https://example.com/lynx.png',
  _raw: null,
};

describe('speciesDetailParser', () => {
  it('maps image metadata aliases and taxonomy path', () => {
    const parsed = parseSpeciesApiDetail(
      {
        description: 'Summary: Wild cat.',
        imageLicense: 'CC-BY',
        imageCreator: 'A. Photographer',
        imageRightsHolder: 'Photo Org',
        imageReferences: '/observations/123',
        taxonomy_path: 'Animalia > Chordata > Mammalia',
      },
      baseNormalized,
    );

    expect(parsed.description).toBe('Summary: Wild cat.');
    expect(parsed.image_license).toBe('CC-BY');
    expect(parsed.image_creator).toBe('A. Photographer');
    expect(parsed.image_rights_holder).toBe('Photo Org');
    expect(parsed.image_references).toBe('/observations/123');
    expect(parsed.taxonomyPath).toBe('Animalia > Chordata > Mammalia');
  });

  it('falls back to description pending and parses sections from profile when provided', () => {
    const parsed = parseSpeciesApiDetail(
      {
        description_profile: {
          sections: [
            {
              id: 'summary',
              title: 'Summary',
              lines: [{ body: 'Medium-sized wild cat.' }],
            },
          ],
        },
      },
      baseNormalized,
    );

    expect(parsed.description).toBe('description pending');
    expect(parsed.description_sections).toEqual([
      {
        id: 'summary',
        title: 'Summary',
        lines: [{ body: 'Medium-sized wild cat.' }],
      },
    ]);
  });

  it('parses sections when profile is provided as camelCase descriptionProfile', () => {
    const parsed = parseSpeciesApiDetail(
      {
        descriptionProfile: {
          sections: [
            {
              title: 'Climate',
              lines: [{ body: 'Cold temperate climates.' }],
            },
          ],
        },
      },
      baseNormalized,
    );

    expect(parsed.description).toBe('description pending');
    expect(parsed.description_sections).toEqual([
      {
        id: 'climate',
        title: 'Climate',
        lines: [{ body: 'Cold temperate climates.' }],
      },
    ]);
  });

  it('maps backend heatmap metadata when available', () => {
    const parsed = parseSpeciesApiDetail(
      {
        heatmap: {
          available: true,
          resolved_model_id: 'taxon_99_gbt_20260313T065439Z',
          phenology_available: true,
          full_available: true,
        },
      },
      baseNormalized,
    );

    expect(parsed.heatmap).toEqual({
      available: true,
      resolved_model_id: 'taxon_99_gbt_20260313T065439Z',
      phenology_available: true,
      full_available: true,
    });
  });

  it('maps camelCase heatmap aliases when present', () => {
    const parsed = parseSpeciesApiDetail(
      {
        heatmap: {
          available: true,
          resolvedModelId: 'taxon_99_alias',
          phenologyAvailable: true,
          fullAvailable: true,
        },
      },
      baseNormalized,
    );

    expect(parsed.heatmap).toEqual({
      available: true,
      resolved_model_id: 'taxon_99_alias',
      phenology_available: true,
      full_available: true,
    });
  });
});
