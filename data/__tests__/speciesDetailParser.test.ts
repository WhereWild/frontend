import { parseSpeciesApiDetail } from '../speciesDetailParser';
import type { SpeciesApiNormalized } from '../types';

const baseNormalized: SpeciesApiNormalized = {
  taxon_id: 99,
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

  it('maps nested legacy and inference heatmap metadata when present', () => {
    const parsed = parseSpeciesApiDetail(
      {
        heatmap: {
          available: true,
          resolved_model_id: 'top_level_model',
          phenology_available: true,
          full_available: true,
          legacy: {
            available: true,
            requested_model_id: 'auto_gbt_sdm',
            resolved_model_id: 'legacy_model_123',
            model_dir: '/tmp/model-dir',
            taxon_id: '99',
            feature_columns: ['bio_1', 'bio_12'],
            summary: { auc: 0.95 },
            metrics: { threshold: 0.42 },
            phenology_available: true,
            full_available: false,
            tile_url: '/api/species/99/heatmap/legacy/tiles/{z}/{x}/{y}.png',
          },
          inference: {
            available: true,
            species_key: 99,
            native_resolution: 0.25,
            tile_url: '/api/species/99/heatmap/tiles/{z}/{x}/{y}.png',
          },
        },
      },
      baseNormalized,
    );

    expect(parsed.heatmap).toEqual({
      available: true,
      resolved_model_id: 'top_level_model',
      phenology_available: true,
      full_available: true,
      legacy: {
        available: true,
        requested_model_id: 'auto_gbt_sdm',
        resolved_model_id: 'legacy_model_123',
        model_dir: '/tmp/model-dir',
        taxon_id: '99',
        feature_columns: ['bio_1', 'bio_12'],
        summary: { auc: 0.95 },
        metrics: { threshold: 0.42 },
        phenology_available: true,
        full_available: false,
        tile_url: '/api/species/99/heatmap/legacy/tiles/{z}/{x}/{y}.png',
      },
      inference: {
        available: true,
        species_key: 99,
        native_resolution: 0.25,
        tile_url: '/api/species/99/heatmap/tiles/{z}/{x}/{y}.png',
      },
    });
  });
});
