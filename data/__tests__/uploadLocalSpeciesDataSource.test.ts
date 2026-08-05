// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  buildUploadLocalSpeciesDataSource,
  normalizeRawUploadedParquetBundle,
  type RawUploadedParquetBundle,
} from '@/data/uploadLocalSpeciesDataSource';

describe('upload local species data source variable categories', () => {
  it('builds variable definitions with categories from variableCategory columns and variable_metadata', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'class_52',
          metricLabel: 'Impervious surfaces',
          value: 0.4,
        },
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'total_samples',
          value: 10,
        },
      ],
      densityGraph: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          points: [1, 2],
          density: [0.1, 0.2],
        },
      ],
      categoricalValueLookup: [
        {
          variable: 'landcover',
          variableName: 'Land Cover Classes',
          variableCategory: 'land',
          code: 52,
          metric: 'class_52',
          label: 'Impervious surfaces',
        },
      ],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [
{
  catalogNumber: 'obs_1',
  bio_1: 2.1,
  elevation: 100,
  landcover: 52,
},
      ],
      summaryStats: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          count: 1,
          min: 2.1,
          mean: 2.1,
          max: 2.1,
          std: 0,
          '10th percentile': 2.1,
          '90th percentile': 2.1,
        },
        {
          variable: 'landcover',
          variableCategory: 'land',
          count: 10,
          min: 52,
          mean: 52,
          max: 52,
          std: 0,
          '10th percentile': 52,
          '90th percentile': 52,
        },
        {
          variable: 'elevation',
          count: 1,
          min: 100,
          mean: 100,
          max: 100,
          std: 0,
          '10th percentile': 100,
          '90th percentile': 100,
        },
      ],
      variableMetadata: [
        {
          id: 'elevation',
          name: 'elevation',
          category: 'terrain',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const definitions = await dataSource.fetchEnvironmentVariables();

    expect(definitions.find((entry) => entry.id === 'bio_1')?.category).toBe('climate');
    expect(definitions.find((entry) => entry.id === 'landcover')?.category).toBe('land');
    expect(definitions.find((entry) => entry.id === 'elevation')?.category).toBe('terrain');
  });

  it('maps categorical occurrence codes to stable categorical keys through categorical_value_lookup', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'class_52',
          metricLabel: 'Impervious surfaces',
          value: 1,
        },
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'total_samples',
          value: 1,
        },
      ],
      categoricalValueLookup: [
        {
          variable: 'landcover',
          variableName: 'Land Cover Classes',
          variableCategory: 'land',
          code: 52,
          metric: 'class_52',
          label: 'Impervious surfaces',
        },
      ],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20, landcover: 52 },
      ],
      occurrenceIndex: [],
      summaryStats: [
        {
          variable: 'landcover',
          variableCategory: 'land',
          count: 1,
          min: 52,
          mean: 52,
          max: 52,
          std: 0,
          '10th percentile': 52,
          '90th percentile': 52,
        },
      ],
      variableMetadata: [],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const stats = await dataSource.fetchSpeciesEnvironment(1, 'landcover');
    expect(stats.variableType).toBe('categorical');
    expect(stats.categoricalDistribution?.length).toBe(1);
    expect(stats.categoricalDistribution?.[0]?.value).toBe('class_52');
    expect(stats.categoricalDistribution?.[0]?.className).toBe('Impervious surfaces');

    const sampleResponse = await dataSource.fetchSpeciesEnvironmentCategorySamples(1, 'landcover', 'class_52');
    expect(sampleResponse.observations.length).toBe(1);
    expect(sampleResponse.observations[0]?.catalogNumber).toBe('obs_1');
  });

  it('adds a warning when categorical occurrence codes cannot be resolved through categorical_value_lookup', () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          metric: 'class_52',
          metricLabel: 'Impervious surfaces',
          value: 3,
        },
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          metric: 'class_130',
          metricLabel: 'Grassland',
          value: 2,
        },
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          metric: 'total_samples',
          value: 5,
        },
      ],
      densityGraph: [],
      occurrences: [{ catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20, landcover: 52 }],
      occurrenceIndex: [],
      summaryStats: [
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          count: 5,
          min: 0,
          mean: 0,
          max: 0,
          std: 0,
          '10th percentile': 0,
          '90th percentile': 0,
        },
      ],
      variableMetadata: [
        {
          id: 'landcover',
          name: 'Land Cover Classes',
          category: 'Earth Surface',
          value_type: 'categorical',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);

    expect(normalizedBundle.meta?.warnings).toEqual([
      'Uploaded categorical variable "Land Cover Classes" has occurrence_index codes that do not resolve through categorical_value_lookup, so categorical highlighting may be unavailable.',
    ]);
  });

  it('maps categorical occurrence codes through categorical_value_lookup before matching categories', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          metric: 'class_52',
          metricLabel: 'Impervious surfaces',
          value: 1,
        },
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          metric: 'total_samples',
          value: 1,
        },
      ],
      categoricalValueLookup: [
        {
          variable: 'landcover',
          variableName: 'Land Cover Classes',
          variableCategory: 'Earth Surface',
          code: 52n,
          metric: 'class_52',
          label: 'Impervious surfaces',
        },
      ],
      densityGraph: [],
      occurrences: [{ catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20, landcover: 52 }],
      occurrenceIndex: [],
      summaryStats: [
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          variableName: 'Land Cover Classes',
          count: 1,
          min: 52,
          mean: 52,
          max: 52,
          std: 0,
          '10th percentile': 52,
          '90th percentile': 52,
        },
      ],
      variableMetadata: [
        {
          id: 'landcover',
          name: 'Land Cover Classes',
          category: 'Earth Surface',
          value_type: 'categorical',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    expect(normalizedBundle.meta?.warnings).toBeUndefined();
    expect(normalizedBundle.occurrenceIndex).toEqual([
      expect.objectContaining({
        variable: 'landcover',
        classValue: 'class_52',
        observationIds: ['obs_1'],
      }),
    ]);

    const stats = await dataSource.fetchSpeciesEnvironment(1, 'landcover');
    expect(stats.categoricalDistribution).toEqual([
      expect.objectContaining({
        value: 'class_52',
        className: 'Impervious surfaces',
      }),
    ]);

    const sampleResponse = await dataSource.fetchSpeciesEnvironmentCategorySamples(
      1,
      'landcover',
      'class_52',
    );
    expect(sampleResponse.observations).toEqual([
      expect.objectContaining({ catalogNumber: 'obs_1' }),
    ]);

    expect(dataSource.fetchObservationEnvironmentValue).toBeDefined();
    await expect(
      dataSource.fetchObservationEnvironmentValue?.(1, 'obs_1', 'landcover'),
    ).resolves.toEqual({
      variable: 'landcover',
      value: 'class_52',
      valueLabel: 'Impervious surfaces',
      valueDescription: null,
      units: null,
    });
  });

  it('uses categorical_stats.metricLabel for display when metric remains a stable key', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          metric: 'class_52',
          metricLabel: 'Impervious surfaces',
          value: 1,
        },
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          metric: 'total_samples',
          value: 1,
        },
      ],
      densityGraph: [],
      occurrences: [{ catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 }],
      occurrenceIndex: [
{
  catalogNumber: 'obs_1',
  landcover: 'class_52',
},
      ],
      summaryStats: [
        {
          variable: 'landcover',
          variableCategory: 'Earth Surface',
          count: 1,
          min: 0,
          mean: 0,
          max: 0,
          std: 0,
          '10th percentile': 0,
          '90th percentile': 0,
        },
      ],
      variableMetadata: [],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    await expect(dataSource.fetchSpeciesEnvironment(1, 'landcover')).resolves.toEqual(
      expect.objectContaining({
        categoricalDistribution: [
          expect.objectContaining({
            value: 'class_52',
            className: 'Impervious surfaces',
          }),
        ],
      }),
    );
  });

  it('builds stats for categorical variables that are missing from summary_stats', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'class_52',
          metricLabel: 'Impervious surfaces',
          value: 0.5,
        },
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'class_130',
          metricLabel: 'Grassland',
          value: 0.5,
        },
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'total_samples',
          value: 2,
        },
      ],
      categoricalValueLookup: [
        {
          variable: 'landcover',
          variableName: 'Land Cover Classes',
          variableCategory: 'land',
          code: 52,
          metric: 'class_52',
          label: 'Impervious surfaces',
        },
        {
          variable: 'landcover',
          variableName: 'Land Cover Classes',
          variableCategory: 'land',
          code: 130,
          metric: 'class_130',
          label: 'Grassland',
        },
      ],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
        { catalogNumber: 'obs_2', decimalLatitude: 11, decimalLongitude: 21 },
      ],
      occurrenceIndex: [
{
  catalogNumber: 'obs_1',
  bio_1: 2.1,
  landcover: 52,
},
{
  catalogNumber: 'obs_2',
  bio_1: 3.1,
  landcover: 130,
},
      ],
      summaryStats: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          count: 2,
          min: 2.1,
          mean: 2.6,
          max: 3.1,
          std: 0.5,
          '10th percentile': 2.1,
          '90th percentile': 3.1,
        },
      ],
      variableMetadata: [
        {
          id: 'landcover',
          name: 'landcover',
          category: 'land',
          valueType: 'categorical',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const stats = await dataSource.fetchSpeciesEnvironment(1, 'landcover');

    expect(stats.variableType).toBe('categorical');
    expect(stats.summary.count).toBe(2);
    expect(stats.categoricalDistribution?.map((entry) => String(entry.value)).sort()).toEqual([
      'class_130',
      'class_52',
    ]);
  });

  it('uses variable metadata ids as canonical keys when labels differ from variable ids', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          points: [1, 2],
          density: [0.2, 0.4],
        },
      ],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [
{
  catalogNumber: 'obs_1',
  bio_1: 2.1,
},
      ],
      summaryStats: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          count: 1,
          min: 2.1,
          mean: 2.1,
          max: 2.1,
          std: 0,
          '10th percentile': 2.1,
          '90th percentile': 2.1,
        },
      ],
      variableMetadata: [
        {
          id: 'bio_1',
          name: 'Mean Annual Temperature',
          category: 'climate',
          units: 'degC',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);

    expect(normalizedBundle.variableDefinitions).toEqual([
      expect.objectContaining({
        id: 'bio_1',
        name: 'Mean Annual Temperature',
        category: 'climate',
        units: 'degC',
      }),
    ]);

    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });
    const stats = await dataSource.fetchSpeciesEnvironment(1, 'bio_1');

    expect(stats.variable).toBe('bio_1');
    expect(stats.variableName).toBe('Mean Annual Temperature');
    await expect(
      dataSource.fetchSpeciesEnvironment(1, 'Mean Annual Temperature'),
    ).rejects.toThrow('Local upload does not include stats for variable: Mean Annual Temperature');
  });

  it('treats exported occurrence column names as display metadata, not canonical ids', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [
        {
          variable: 'bio_1',
          variableName: 'Annual Mean Temperature',
          variableCategory: 'Bioclimatic',
          points: '[0, 10, 20]',
          density: '[0.1, 0.4, 0.1]',
        },
      ],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20, bio_1: 12.5 },
      ],
      occurrenceIndex: [],
      summaryStats: [
        {
          variable: 'bio_1',
          variableName: 'Annual Mean Temperature',
          variableCategory: 'Bioclimatic',
          count: 1,
          min: 12.5,
          mean: 12.5,
          max: 12.5,
          std: 0,
          '10th percentile': 12.5,
          '90th percentile': 12.5,
        },
      ],
      variableMetadata: [
        {
          id: 'bio_1',
          name: 'Annual Mean Temperature',
          exported_name: 'Annual Mean Temperature',
          category: 'Bioclimatic',
          units: '°C',
          value_type: 'numeric',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    expect(normalizedBundle.variableDefinitions).toEqual([
      expect.objectContaining({
        id: 'bio_1',
        name: 'Annual Mean Temperature',
        valueType: 'numeric',
      }),
    ]);
    expect(normalizedBundle.summaryStats).toEqual([
      expect.objectContaining({ variable: 'bio_1', variableName: 'Annual Mean Temperature' }),
    ]);
    expect(normalizedBundle.densityGraph).toEqual([
      expect.objectContaining({ variable: 'bio_1', value: 0, density: 0.1 }),
      expect.objectContaining({ variable: 'bio_1', value: 10, density: 0.4 }),
      expect.objectContaining({ variable: 'bio_1', value: 20, density: 0.1 }),
    ]);
    expect(normalizedBundle.occurrenceIndex).toEqual([
      expect.objectContaining({ variable: 'bio_1', observationIds: ['obs_1'] }),
    ]);

    await expect(dataSource.fetchEnvironmentVariables()).resolves.toEqual([
      expect.objectContaining({ id: 'bio_1', name: 'Annual Mean Temperature' }),
    ]);
    await expect(dataSource.fetchSpeciesEnvironment(1, 'bio_1')).resolves.toEqual(
      expect.objectContaining({
        variable: 'bio_1',
        variableName: 'Annual Mean Temperature',
        densityCurve: { points: [0, 10, 20], density: [0.1, 0.4, 0.1] },
      }),
    );
  });

  it('does not rewrite display labels back onto metadata ids', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [
        {
          variable: 'Annual Mean Temperature',
          variableCategory: 'Bioclimatic',
          points: '[0, 10, 20]',
          density: '[0.1, 0.4, 0.1]',
        },
      ],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20, 'Annual Mean Temperature': 12.5 },
      ],
      occurrenceIndex: [],
      summaryStats: [
        {
          variable: 'Annual Mean Temperature',
          variableCategory: 'Bioclimatic',
          count: 1,
          min: 12.5,
          mean: 12.5,
          max: 12.5,
          std: 0,
          '10th percentile': 12.5,
          '90th percentile': 12.5,
        },
      ],
      variableMetadata: [
        {
          id: 'bio_1',
          name: 'Annual Mean Temperature',
          exported_name: 'Annual Mean Temperature',
          category: 'Bioclimatic',
          units: '°C',
          value_type: 'numeric',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);

    expect(normalizedBundle.summaryStats).toEqual([
      expect.objectContaining({ variable: 'Annual Mean Temperature' }),
    ]);
    expect(normalizedBundle.occurrenceIndex).toEqual([
      expect.objectContaining({ variable: 'Annual Mean Temperature', observationIds: ['obs_1'] }),
    ]);
    expect(normalizedBundle.variableDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'bio_1', name: 'Annual Mean Temperature' }),
        expect.objectContaining({ id: 'Annual Mean Temperature', name: 'Annual Mean Temperature' }),
      ]),
    );
  });

  it('prefers metadata name over exported_name for display labels', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [
{
  catalogNumber: 'obs_1',
  bio_1: 12.5,
},
      ],
      summaryStats: [
        {
          variable: 'bio_1',
          count: 1,
          min: 12.5,
          mean: 12.5,
          max: 12.5,
          std: 0,
          '10th percentile': 12.5,
          '90th percentile': 12.5,
        },
      ],
      variableMetadata: [
        {
          id: 'bio_1',
          name: 'Annual Mean Temperature',
          exported_name: 'Annual Mean Temperature (degC)',
          units: 'degC',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);

    expect(normalizedBundle.variableDefinitions).toEqual([
      expect.objectContaining({
        id: 'bio_1',
        name: 'Annual Mean Temperature',
      }),
    ]);
  });

  it('prefers exported_name over raw variable ids when metadata name is absent', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [
{
  catalogNumber: 'obs_1',
  bio_1: 12.5,
},
      ],
      summaryStats: [
        {
          variable: 'bio_1',
          count: 1,
          min: 12.5,
          mean: 12.5,
          max: 12.5,
          std: 0,
          '10th percentile': 12.5,
          '90th percentile': 12.5,
        },
      ],
      variableMetadata: [
        {
          id: 'bio_1',
          variable: 'bio_1',
          exported_name: 'Annual Mean Temperature',
          units: 'degC',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    expect(normalizedBundle.variableDefinitions).toEqual([
      expect.objectContaining({
        id: 'bio_1',
        name: 'Annual Mean Temperature',
      }),
    ]);
    await expect(dataSource.fetchEnvironmentVariables()).resolves.toEqual([
      expect.objectContaining({ id: 'bio_1', name: 'Annual Mean Temperature' }),
    ]);
  });

  it('uses stats file display metadata when stable ids remain in the variable column', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [
        {
          variable: 'bio_1',
          variableName: 'Annual Mean Temperature',
          variableCategory: 'Bioclimatic',
          points: '[0, 10, 20]',
          density: '[0.1, 0.4, 0.1]',
        },
      ],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [
{
  catalogNumber: 'obs_1',
  bio_1: 12.5,
},
      ],
      summaryStats: [
        {
          variable: 'bio_1',
          variableName: 'Annual Mean Temperature',
          variableCategory: 'Bioclimatic',
          units: 'degC',
          variableType: 'numeric',
          count: 1,
          min: 12.5,
          mean: 12.5,
          max: 12.5,
          std: 0,
          '10th percentile': 12.5,
          '90th percentile': 12.5,
        },
      ],
      variableMetadata: [
        {
          id: 'bio_1',
          name: 'Bio 1',
          exported_name: 'Annual Mean Temperature',
          units: 'degC',
          value_type: 'numeric',
          category: 'Bioclimatic',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    expect(normalizedBundle.summaryStats).toEqual([
      expect.objectContaining({
        variable: 'bio_1',
        variableName: 'Annual Mean Temperature',
        units: 'degC',
        variableType: 'numeric',
      }),
    ]);
    await expect(dataSource.fetchSpeciesEnvironment(1, 'bio_1')).resolves.toEqual(
      expect.objectContaining({
        variable: 'bio_1',
        variableName: 'Annual Mean Temperature',
        units: 'degC',
        variableType: 'numeric',
      }),
    );
    await expect(dataSource.fetchEnvironmentVariables()).resolves.toEqual([
      expect.objectContaining({
        id: 'bio_1',
        name: 'Bio 1',
        units: 'degC',
        valueType: 'numeric',
      }),
    ]);
  });

  it('does not expose metadata-only or index-only variables in the local variable catalog', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          points: [1, 2],
          density: [0.2, 0.4],
        },
      ],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20 },
      ],
      occurrenceIndex: [
{
  catalogNumber: 'obs_1',
  bio_1: 2.1,
  elevation: 100,
},
      ],
      summaryStats: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          count: 1,
          min: 2.1,
          mean: 2.1,
          max: 2.1,
          std: 0,
          '10th percentile': 2.1,
          '90th percentile': 2.1,
        },
      ],
      variableMetadata: [
        {
          id: 'elevation',
          name: 'Elevation',
          category: 'terrain',
          units: 'm',
        },
        {
          id: 'unused_meta_only',
          name: 'Unused Meta Only',
          category: 'terrain',
        },
      ],
      variableDefinitions: [
        {
          id: 'bio_1',
          name: 'Mean Annual Temperature',
          category: 'climate',
          units: 'degC',
          valueType: 'continuous',
        },
        {
          id: 'elevation',
          name: 'Elevation',
          category: 'terrain',
          units: 'm',
          valueType: 'continuous',
        },
        {
          id: 'unused_meta_only',
          name: 'Unused Meta Only',
          category: 'terrain',
          valueType: 'continuous',
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    await expect(dataSource.fetchEnvironmentVariables()).resolves.toEqual([
      expect.objectContaining({ id: 'bio_1' }),
    ]);
    await expect(dataSource.fetchSpeciesEnvironment(1, 'bio_1')).resolves.toEqual(
      expect.objectContaining({ variable: 'bio_1' }),
    );
  });

  it('preserves numeric catalog numbers from object-form occurrence index rows', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          points: [2.1],
          density: [1],
        },
      ],
      occurrences: [
        { catalogNumber: 123, decimalLatitude: 10, decimalLongitude: 20, bio_1: 2.1 },
      ],
      occurrenceIndex: [],
      summaryStats: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          count: 1,
          min: 2.1,
          mean: 2.1,
          max: 2.1,
          std: 0,
          '10th percentile': 2.1,
          '90th percentile': 2.1,
        },
      ],
      variableMetadata: [],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });
    const slice = await dataSource.fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio_1',
      min: 2,
      max: 3,
    });

    expect(normalizedBundle.occurrenceIndex).toEqual([
      expect.objectContaining({
        variable: 'bio_1',
        observationIds: ['123'],
      }),
    ]);
    expect(slice.observations).toEqual([
      expect.objectContaining({ catalogNumber: '123', latitude: 10, longitude: 20 }),
    ]);
  });



  it('filters uploaded locations correctly when callers use string levels', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        {
          catalogNumber: 'obs_1',
          decimalLatitude: 10,
          decimalLongitude: 20,
          locationGid: 'county-us-ca-sf',
          bio_1: 2.1,
        },
      ],
      occurrenceIndex: [],
      summaryStats: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          count: 1,
          min: 2.1,
          mean: 2.1,
          max: 2.1,
          std: 0,
          '10th percentile': 2.1,
          '90th percentile': 2.1,
        },
      ],
      variableMetadata: [],
      locations: [
        { gid: 'country-us', name: 'United States', level: 0, hierarchy: [] },
        { gid: 'state-us-ca', name: 'California', level: 1, hierarchy: ['country-us'] },
        {
          gid: 'county-us-ca-sf',
          name: 'San Francisco County',
          level: 2,
          hierarchy: ['country-us', 'state-us-ca'],
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    await expect(dataSource.fetchSpeciesLocations(1, 'country')).resolves.toEqual([
      expect.objectContaining({ gid: 'country-us', level: 0 }),
    ]);
    await expect(dataSource.fetchSpeciesLocations(1, 'state', 'United States')).resolves.toEqual([
      expect.objectContaining({ gid: 'state-us-ca', level: 1 }),
    ]);
    await expect(dataSource.fetchSpeciesLocations(1, 'county', 'California')).resolves.toEqual([
      expect.objectContaining({ gid: 'county-us-ca-sf', level: 2 }),
    ]);

    await expect(dataSource.fetchSpeciesOccurrences(1, { location: 'state-us-ca' })).resolves.toMatchObject({
      occurrences: [expect.objectContaining({ catalogNumber: 'obs_1', latitude: 10, longitude: 20 })],
    });
    await expect(
      dataSource.fetchEnvironmentRangeSlice({
        taxonId: '1',
        variableId: 'bio_1',
        min: 2,
        max: 3,
        location: 'country-us',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        count: 1,
        observations: [
          expect.objectContaining({ catalogNumber: 'obs_1', latitude: 10, longitude: 20 }),
        ],
      }),
    );
  });

  it('rebuilds environment stats for the active location scope instead of returning global stats', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'class_52',
          metricLabel: 'Impervious surfaces',
          value: 0.5,
        },
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'class_130',
          metricLabel: 'Grassland',
          value: 0.5,
        },
        {
          variable: 'landcover',
          variableCategory: 'land',
          metric: 'total_samples',
          value: 2,
        },
      ],
      categoricalValueLookup: [
        {
          variable: 'landcover',
          variableName: 'Land Cover Classes',
          variableCategory: 'land',
          code: 52,
          metric: 'class_52',
          label: 'Impervious surfaces',
          description: 'Built surfaces and paved ground.',
        },
        {
          variable: 'landcover',
          variableName: 'Land Cover Classes',
          variableCategory: 'land',
          code: 130,
          metric: 'class_130',
          label: 'Grassland',
          description: 'Open herbaceous cover.',
        },
      ],
      densityGraph: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          points: [2.1, 3.1],
          density: [0.5, 0.5],
        },
      ],
      occurrences: [
        {
          catalogNumber: 'obs_ca',
          decimalLatitude: 10,
          decimalLongitude: 20,
          locationGid: 'county-us-ca-sf',
          bio_1: 2.1,
          landcover: 52,
        },
        {
          catalogNumber: 'obs_nv',
          decimalLatitude: 11,
          decimalLongitude: 21,
          locationGid: 'county-us-nv-ck',
          bio_1: 3.1,
          landcover: 130,
        },
      ],
      occurrenceIndex: [],
      summaryStats: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          count: 2,
          min: 2.1,
          mean: 2.6,
          max: 3.1,
          std: 0.5,
          '10th percentile': 2.1,
          '90th percentile': 3.1,
        },
      ],
      variableMetadata: [],
      locations: [
        { gid: 'country-us', name: 'United States', level: 0, hierarchy: [] },
        { gid: 'state-us-ca', name: 'California', level: 1, hierarchy: ['country-us'] },
        { gid: 'state-us-nv', name: 'Nevada', level: 1, hierarchy: ['country-us'] },
        {
          gid: 'county-us-ca-sf',
          name: 'San Francisco County',
          level: 2,
          hierarchy: ['country-us', 'state-us-ca'],
        },
        {
          gid: 'county-us-nv-ck',
          name: 'Clark County',
          level: 2,
          hierarchy: ['country-us', 'state-us-nv'],
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const globalStats = await dataSource.fetchSpeciesEnvironment(1, 'bio_1');
    const californiaStats = await dataSource.fetchSpeciesEnvironment(1, 'bio_1', {
      location: 'state-us-ca',
    });

    expect(globalStats.summary).toEqual(
      expect.objectContaining({ count: 2, min: 2.1, mean: 2.6, max: 3.1 }),
    );
    expect(californiaStats.summary).toEqual(
      expect.objectContaining({ count: 1, min: 2.1, mean: 2.1, max: 2.1 }),
    );
    expect(californiaStats.baselineSummary).toEqual(globalStats.summary);
    expect(californiaStats.histogram).toEqual({
      bins: [2.079, 2.121],
      counts: [1],
    });
    expect(californiaStats.densityCurve).toBeNull();

    const californiaLandcoverStats = await dataSource.fetchSpeciesEnvironment(1, 'landcover', {
      location: 'state-us-ca',
    });
    expect(californiaLandcoverStats.categoricalDistribution).toEqual([
      expect.objectContaining({
        value: 'class_52',
        className: 'Impervious surfaces',
        description: 'Built surfaces and paved ground.',
        count: 1,
      }),
    ]);
  });

  it('keeps duplicate parent names on the selected gid branch when fetching local children', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        {
          catalogNumber: 'obs_nj',
          decimalLatitude: 40,
          decimalLongitude: -74,
          locationGid: 'county-us-nj-washington',
        },
        {
          catalogNumber: 'obs_co',
          decimalLatitude: 39,
          decimalLongitude: -105,
          locationGid: 'county-us-co-washington',
        },
      ],
      occurrenceIndex: [
{
  catalogNumber: 'obs_nj',
  bio_1: 2.1,
},
{
  catalogNumber: 'obs_co',
  bio_1: 3.1,
},
      ],
      summaryStats: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          count: 2,
          min: 2.1,
          mean: 2.6,
          max: 3.1,
          std: 0.5,
          '10th percentile': 2.1,
          '90th percentile': 3.1,
        },
      ],
      variableMetadata: [],
      locations: [
        { gid: 'country-us', name: 'United States', level: 0, hierarchy: [] },
        { gid: 'state-us-nj', name: 'Washington', level: 1, hierarchy: ['country-us'] },
        { gid: 'state-us-co', name: 'Washington', level: 1, hierarchy: ['country-us'] },
        {
          gid: 'county-us-nj-washington',
          name: 'Mercer County',
          level: 2,
          hierarchy: ['country-us', 'state-us-nj'],
        },
        {
          gid: 'county-us-co-washington',
          name: 'Adams County',
          level: 2,
          hierarchy: ['country-us', 'state-us-co'],
        },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    await expect(dataSource.fetchSpeciesLocations(1, 'county', 'state-us-nj')).resolves.toEqual([
      expect.objectContaining({ gid: 'county-us-nj-washington' }),
    ]);
    await expect(dataSource.fetchSpeciesOccurrences(1, { location: 'state-us-nj' })).resolves.toMatchObject({
      occurrences: [expect.objectContaining({ catalogNumber: 'obs_nj' })],
    });
  });

  it('does not match unrelated duplicate-name branches by a location\'s own name', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        {
          catalogNumber: 'obs_selected',
          decimalLatitude: 40,
          decimalLongitude: -74,
          locationGid: 'state-us-nj',
        },
        {
          catalogNumber: 'obs_other',
          decimalLatitude: 39,
          decimalLongitude: -105,
          locationGid: 'state-us-co',
        },
      ],
      occurrenceIndex: [
{
  catalogNumber: 'obs_selected',
  bio_1: 2.1,
},
{
  catalogNumber: 'obs_other',
  bio_1: 3.1,
},
      ],
      summaryStats: [
        {
          variable: 'bio_1',
          variableCategory: 'climate',
          count: 2,
          min: 2.1,
          mean: 2.6,
          max: 3.1,
          std: 0.5,
          '10th percentile': 2.1,
          '90th percentile': 3.1,
        },
      ],
      variableMetadata: [],
      locations: [
        { gid: 'country-us', name: 'United States', level: 0, hierarchy: [] },
        { gid: 'state-us-nj', name: 'Washington', level: 1, hierarchy: ['country-us'] },
        { gid: 'state-us-co', name: 'Washington', level: 1, hierarchy: ['country-us'] },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    await expect(dataSource.fetchSpeciesOccurrences(1, { location: 'state-us-nj' })).resolves.toMatchObject({
      occurrences: [expect.objectContaining({ catalogNumber: 'obs_selected' })],
    });
  });

  it('converts variable units and stats to imperial when requested', async () => {
    const rawBundle: RawUploadedParquetBundle = {
      categoricalStats: [],
      densityGraph: [],
      occurrences: [
        { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20, bio_1: 20 },
      ],
      occurrenceIndex: [],
      summaryStats: [
        {
          variable: 'bio_1',
          count: 1,
          min: 20,
          mean: 20,
          max: 20,
          std: 1,
          '10th percentile': 20,
          '90th percentile': 20,
        },
      ],
      variableMetadata: [
        { id: 'bio_1', name: 'Annual Mean Temperature', units: '°C' },
      ],
    };

    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const defs = await dataSource.fetchEnvironmentVariables({ units: 'imperial' });
    expect(defs[0]?.units).toBe('°F');

    const stats = await dataSource.fetchSpeciesEnvironment(1, 'bio_1', { units: 'imperial' });
    expect(stats.units).toBe('°F');
    expect(stats.summary.mean).toBeCloseTo(68, 1);

    const metricStats = await dataSource.fetchSpeciesEnvironment(1, 'bio_1');
    expect(metricStats.units).toBe('°C');

    const sliceImperial = await dataSource.fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio_1',
      min: 68,
      max: 68,
      units: 'imperial',
    });
    expect(sliceImperial.observations).toHaveLength(1);
  });
});

describe('upload local species data source chained extra-variable filters', () => {
  // obs_1: bio_1=10, landcover=52   obs_2: bio_1=20, landcover=52   obs_3: bio_1=30, landcover=130
  const rawBundle: RawUploadedParquetBundle = {
    categoricalStats: [
      { variable: 'landcover', variableCategory: 'land', metric: 'class_52', metricLabel: 'Impervious surfaces', value: 2 },
      { variable: 'landcover', variableCategory: 'land', metric: 'class_130', metricLabel: 'Grassland', value: 1 },
      { variable: 'landcover', variableCategory: 'land', metric: 'total_samples', value: 3 },
    ],
    categoricalValueLookup: [
      { variable: 'landcover', variableName: 'Land Cover Classes', variableCategory: 'land', code: 52, metric: 'class_52', label: 'Impervious surfaces' },
      { variable: 'landcover', variableName: 'Land Cover Classes', variableCategory: 'land', code: 130, metric: 'class_130', label: 'Grassland' },
    ],
    densityGraph: [
      { variable: 'bio_1', variableCategory: 'climate', points: [10, 20, 30], density: [0.1, 0.2, 0.1] },
    ],
    occurrences: [
      { catalogNumber: 'obs_1', decimalLatitude: 10, decimalLongitude: 20, bio_1: 10, landcover: 52, aspect_deg: 355 },
      { catalogNumber: 'obs_2', decimalLatitude: 11, decimalLongitude: 21, bio_1: 20, landcover: 52, aspect_deg: 200 },
      { catalogNumber: 'obs_3', decimalLatitude: 12, decimalLongitude: 22, bio_1: 30, landcover: 130, aspect_deg: 5 },
    ],
    occurrenceIndex: [],
    summaryStats: [
      {
        variable: 'bio_1',
        variableCategory: 'climate',
        count: 3,
        min: 10,
        mean: 20,
        max: 30,
        std: 8.16,
        '10th percentile': 10,
        '90th percentile': 30,
      },
      {
        variable: 'aspect_deg',
        variableCategory: 'climate',
        count: 3,
        min: 0,
        mean: 180,
        max: 355,
        std: 100,
        '10th percentile': 5,
        '90th percentile': 355,
      },
    ],
    variableMetadata: [],
  };

  it('intersects a chained categorical filter onto a numeric slice request', async () => {
    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const slice = await dataSource.fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio_1',
      min: 0,
      max: 100,
      extra: [{ variableId: 'landcover', classValue: 52 }],
    });

    expect(new Set(slice.observations.map((o) => o.catalogNumber))).toEqual(
      new Set(['obs_1', 'obs_2']),
    );
  });

  it('intersects a chained numeric range filter onto a categorical samples request', async () => {
    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const sample = await dataSource.fetchSpeciesEnvironmentCategorySamples(1, 'landcover', 'class_52', {
      extra: [{ variableId: 'bio_1', min: 15, max: 100 }],
    });

    expect(sample.observations.map((o) => o.catalogNumber)).toEqual(['obs_2']);
  });

  it('intersects a chained numeric range filter onto the categorical stats/distribution endpoint', async () => {
    // Exercises buildScopedCategoricalStats specifically (the stats
    // endpoint's per-class-value distribution), not the samples endpoint —
    // this is the code path that recomputed the chain-filter match once PER
    // CLASS before being fixed (redundant work, only visible as a real
    // slowdown, not a correctness bug — but a correctness regression here
    // would mean the fix broke something while removing that redundancy).
    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const stats = await dataSource.fetchSpeciesEnvironment(1, 'landcover', {
      extra: [{ variableId: 'bio_1', min: 15, max: 100 }],
    });

    // bio_1 15-100 excludes obs_1 (bio_1=10), keeping obs_2 (landcover=52)
    // and obs_3 (landcover=130) — one of each class, not the unfiltered
    // 2-vs-1 split across all three rows.
    expect(stats.summary?.count).toBe(2);
    const fractions = Object.fromEntries(
      (stats.categoricalDistribution ?? []).map((entry) => [
        entry.value,
        entry.fraction,
      ]),
    );
    expect(fractions).toEqual({ class_52: 0.5, class_130: 0.5 });
  });

  it('intersects a chained multi-class (OR) filter onto a numeric slice request', async () => {
    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const slice = await dataSource.fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio_1',
      min: 0,
      max: 100,
      extra: [{ variableId: 'landcover', classValues: [52, 130] }],
    });

    // classValues=[52,130] matches ALL three rows (52 OR 130), unlike the
    // single-classValue=52 test above which only matches obs_1/obs_2.
    expect(new Set(slice.observations.map((o) => o.catalogNumber))).toEqual(
      new Set(['obs_1', 'obs_2', 'obs_3']),
    );
  });

  it('intersects a chained multi-range (OR) filter onto a categorical samples request', async () => {
    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const sample = await dataSource.fetchSpeciesEnvironmentCategorySamples(1, 'landcover', 'class_52', {
      extra: [
        {
          variableId: 'bio_1',
          ranges: [
            { min: 5, max: 15 },
            { min: 25, max: 35 },
          ],
        },
      ],
    });

    // Primary landcover=52 matches obs_1 (bio_1=10) and obs_2 (bio_1=20).
    // ranges OR-matches [5,15] and [25,35] — obs_1's bio_1=10 falls in the
    // first range; obs_2's bio_1=20 falls in neither.
    expect(sample.observations.map((o) => o.catalogNumber)).toEqual(['obs_1']);
  });

  it('intersects a chained wraparound (circular) range filter onto a numeric slice request', async () => {
    // aspect_deg: obs_1=355, obs_2=200, obs_3=5. A chained min=350/max=10
    // range means min > max — a wraparound arc through 0/360 (350→360
    // ∪ 0→10), matching obs_1 (355) and obs_3 (5) but not obs_2 (200).
    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const slice = await dataSource.fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio_1',
      min: 0,
      max: 100,
      extra: [{ variableId: 'aspect_deg', min: 350, max: 10 }],
    });

    expect(new Set(slice.observations.map((o) => o.catalogNumber))).toEqual(
      new Set(['obs_1', 'obs_3']),
    );
  });

  it('intersects a chained multi-range (OR) filter with a wraparound sub-range', async () => {
    // ranges OR-matches a wraparound arc [350,10] (catches obs_1=355,
    // obs_3=5) with a plain [190,210] arc (catches obs_2=200) — all three
    // rows should match across the two OR'd ranges.
    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const slice = await dataSource.fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio_1',
      min: 0,
      max: 100,
      extra: [
        {
          variableId: 'aspect_deg',
          ranges: [
            { min: 350, max: 10 },
            { min: 190, max: 210 },
          ],
        },
      ],
    });

    expect(new Set(slice.observations.map((o) => o.catalogNumber))).toEqual(
      new Set(['obs_1', 'obs_2', 'obs_3']),
    );
  });

  it('returns nothing when a chained filter matches no rows', async () => {
    const normalizedBundle = normalizeRawUploadedParquetBundle(rawBundle);
    const dataSource = buildUploadLocalSpeciesDataSource({ bundle: normalizedBundle, speciesId: 1 });

    const slice = await dataSource.fetchEnvironmentRangeSlice({
      taxonId: '1',
      variableId: 'bio_1',
      min: 0,
      max: 100,
      extra: [{ variableId: 'landcover', classValue: 999 }],
    });

    expect(slice.observations).toHaveLength(0);
  });
});
