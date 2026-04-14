import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSpeciesEnvironmentState } from '../useSpeciesEnvironmentState';
import {
  fetchEnvironmentVariables,
  fetchSpeciesEnvironment,
  fetchEnvironmentRangeSlice,
  fetchSpeciesEnvironmentCategorySamples,
  fetchPointEnvironmentValue,
} from '@/data/api';
import type { EnvironmentVariableOption } from '../model';
import type {
  EnvironmentVariableDefinition,
  SpeciesEnvironmentCategorySampleResponse,
  SpeciesEnvironmentSliceResponse,
  SpeciesEnvironmentStats,
} from '@/data/types';

jest.mock('@/data/api', () => ({
  fetchEnvironmentVariables: jest.fn(),
  fetchSpeciesEnvironment: jest.fn(),
  fetchEnvironmentRangeSlice: jest.fn(),
  fetchSpeciesEnvironmentCategorySamples: jest.fn(),
  fetchPointEnvironmentValue: jest.fn(),
}));

const mockFetchEnvironmentVariables = jest.mocked(fetchEnvironmentVariables);
const mockFetchSpeciesEnvironment = jest.mocked(fetchSpeciesEnvironment);
const mockFetchEnvironmentRangeSlice = jest.mocked(fetchEnvironmentRangeSlice);
const mockFetchSpeciesEnvironmentCategorySamples = jest.mocked(
  fetchSpeciesEnvironmentCategorySamples,
);
const mockFetchPointEnvironmentValue = jest.mocked(fetchPointEnvironmentValue);

const continuousStats: SpeciesEnvironmentStats = {
  speciesId: 1,
  variable: 'bio_1',
  variableName: 'Annual Temperature',
  units: 'C',
  variableType: 'continuous',
  observationCount: 20,
  summary: { count: 20, min: 1, mean: 10, max: 19, stddev: 2, q01: 2, q99: 18 },
  histogram: { bins: [0, 10, 20], counts: [10, 10] },
  densityCurve: { points: [1, 10, 19], density: [0.1, 0.9, 0.1] },
  relativeRanks: [
    {
      metric: 'mean',
      label: 'Mammalia',
      rank: 2,
      count: 100,
      percentile: 0.98,
    },
    {
      metric: 'mean',
      label: 'Chordata',
      rank: 10,
      count: 500,
      percentile: 0.9,
    },
  ],
};

const categoricalStats: SpeciesEnvironmentStats = {
  speciesId: 1,
  variable: 'landcover',
  variableName: 'Land Cover',
  units: null,
  variableType: 'categorical',
  observationCount: 5,
  summary: { count: 5, min: null, mean: null, max: null, q01: null, q99: null },
  histogram: null,
  densityCurve: null,
  categoricalDistribution: [
    { value: 'forest', className: 'Forest', count: 3, fraction: 0.6 },
    { value: 'grassland', className: 'Grassland', count: 2, fraction: 0.4 },
  ],
  categoricalSamples: [{ value: 'forest', observationIds: ['A1', 'B2'] }],
  relativeRanks: [],
};

const variableCatalog: EnvironmentVariableDefinition[] = [
  {
    id: 'bio_1',
    name: 'Annual Temperature',
    units: 'C',
    valueType: 'continuous',
  },
  {
    id: 'landcover',
    name: 'Land Cover',
    units: null,
    valueType: 'categorical',
  },
];

const variableOptions: EnvironmentVariableOption[] = [
  {
    id: 'bio_1',
    label: 'Annual Temperature',
    units: 'C',
    valueType: 'continuous',
    category: 'Climate',
  },
  {
    id: 'landcover',
    label: 'Land Cover',
    units: null,
    valueType: 'categorical',
    category: 'Categorical',
  },
];

const continuousVariableOptions: EnvironmentVariableOption[] = [
  variableOptions[0],
];

const categoricalVariableOptions: EnvironmentVariableOption[] = [
  variableOptions[1],
];

describe('useSpeciesEnvironmentState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchEnvironmentRangeSlice.mockResolvedValue({
      speciesId: 1,
      variable: 'bio_1',
      range: { min: 2, max: 12 },
      limit: null,
      count: 1,
      observations: [
        { catalogNumber: 42, value: 8.5, latitude: 0, longitude: 0 },
      ],
    } satisfies SpeciesEnvironmentSliceResponse);
    mockFetchPointEnvironmentValue.mockResolvedValue({
      variable: 'bio_1',
      units: null,
      lat: 40.2,
      lon: -105.1,
      value: 7.25,
      valueLabel: null,
      valueDescription: null,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads variable metadata and continuous stats', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue([
      {
        id: 'bio_1',
        name: 'Annual Temperature',
        units: 'C',
        valueType: 'continuous',
        category: 'Climate',
      },
    ]);
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        variables: [variableOptions[0]],
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());

    expect(result.current.selectedVariable).toBe('bio_1');
    expect(result.current.categories).toEqual(['Climate']);
    expect(result.current.selectedVariableCategory).toBe('Climate');
    expect(result.current.filteredVariables.length).toBeGreaterThan(0);
    expect(result.current.filteredVariables[0]).toMatchObject({
      id: 'bio_1',
      label: 'Annual Temperature',
      units: 'C',
      valueType: 'continuous',
      category: 'Climate',
    });
    expect(result.current.isCategorical).toBe(false);
    expect(result.current.headingText).toContain('Annual Temperature');
    expect(mockFetchSpeciesEnvironment).toHaveBeenCalled();
  });

  it('handles variable catalog fetch failure gracefully', async () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    mockFetchEnvironmentVariables.mockRejectedValue(new Error('no catalog'));
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
      }),
    );

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(result.current.stats).toBeTruthy();
    });

    warnSpy.mockRestore();
  });

  it('fetches range observations and publishes highlight IDs for continuous selection', async () => {
    const onHighlightChange = jest.fn();
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        onHighlightChange,
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());

    act(() => {
      result.current.handleDensitySelectionChange({ start: 2, end: 12 });
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
    );
    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([42]));
  });

  it('publishes categorical highlight IDs for selected category', async () => {
    const onHighlightChange = jest.fn();
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue(categoricalStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        onHighlightChange,
        variables: categoricalVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());
    expect(result.current.isCategorical).toBe(true);

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
    );
  });

  it('derives pinnedCategoryValue for categorical variables from the selected location lookup', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...categoricalStats,
      categoricalDistribution: [
        { value: 41, className: 'Forest', count: 3, fraction: 0.6 },
        { value: 52, className: 'Grassland', count: 2, fraction: 0.4 },
      ],
    });
    mockFetchPointEnvironmentValue.mockResolvedValue({
      variable: 'landcover',
      units: null,
      lat: 40.2,
      lon: -105.1,
      value: 41,
      valueLabel: 'Forest',
      valueDescription: null,
    });
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
      speciesId: 1,
      variable: 'landcover',
      classValue: 41,
      observations: [
        {
          catalogNumber: 'OBS-1',
          value: null,
          latitude: null,
          longitude: null,
        },
      ],
      count: 1,
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        pinnedObservation: { catalogNumber: 'PIN-1', lat: 40.2, lon: -105.1 },
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());
    await waitFor(() => expect(result.current.pinnedValue).toBe(41));

    expect(result.current.pinnedCategoryValue).toBe(41);
    expect(result.current.pinnedUnobservedCategory).toBeNull();
  });

  it('surfaces an unobserved pinned categorical badge when the point category is absent', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...categoricalStats,
      categoricalDistribution: [
        { value: 41, className: 'Forest', count: 3, fraction: 0.6 },
        { value: 52, className: 'Grassland', count: 2, fraction: 0.4 },
      ],
    });
    mockFetchPointEnvironmentValue.mockResolvedValue({
      variable: 'landcover',
      units: null,
      lat: 40.2,
      lon: -105.1,
      value: 90,
      valueLabel: 'Urban',
      valueDescription: 'Developed land',
    });
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
      speciesId: 1,
      variable: 'landcover',
      classValue: 90,
      observations: [],
      count: 0,
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        pinnedObservation: {
          catalogNumber: 'PIN-POINT',
          lat: 40.2,
          lon: -105.1,
        },
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());
    await waitFor(() => expect(result.current.pinnedValue).toBe(90));

    expect(result.current.pinnedCategoryValue).toBeNull();
    expect(result.current.pinnedUnobservedCategory).toEqual({
      value: 90,
      label: 'Urban',
      description: 'Developed land',
    });
  });

  it('treats zero-count categorical classes as unobserved for pinned point highlights', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...categoricalStats,
      categoricalDistribution: [
        { value: 41, className: 'Forest', count: 3, fraction: 0.6 },
        { value: 52, className: 'Grassland', count: 2, fraction: 0.4 },
        { value: 90, className: 'Urban', count: 0, fraction: 0 },
      ],
    });
    mockFetchPointEnvironmentValue.mockResolvedValue({
      variable: 'landcover',
      units: null,
      lat: 40.2,
      lon: -105.1,
      value: 90,
      valueLabel: 'Urban',
      valueDescription: 'Developed land',
    });
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
      speciesId: 1,
      variable: 'landcover',
      classValue: 90,
      observations: [],
      count: 0,
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        pinnedObservation: {
          catalogNumber: 'PIN-POINT',
          lat: 40.2,
          lon: -105.1,
        },
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());
    await waitFor(() => expect(result.current.pinnedValue).toBe(90));

    expect(result.current.pinnedCategoryValue).toBeNull();
    expect(result.current.pinnedUnobservedCategory).toEqual({
      value: 90,
      label: 'Urban',
      description: 'Developed land',
    });
  });

  it('matches observed categorical classes by label when point lookup omits category value', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...categoricalStats,
      categoricalDistribution: [
        { value: 'forest', className: 'Forest', count: 3, fraction: 0.6 },
        { value: 'grassland', className: 'Grassland', count: 2, fraction: 0.4 },
      ],
    });
    mockFetchPointEnvironmentValue.mockResolvedValue({
      variable: 'landcover',
      units: null,
      lat: 40.2,
      lon: -105.1,
      value: 'Forest',
      valueLabel: 'Forest',
      valueDescription: null,
    });
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
      speciesId: 1,
      variable: 'landcover',
      classValue: 'Forest',
      observations: [
        {
          catalogNumber: 'OBS-1',
          value: null,
          latitude: null,
          longitude: null,
        },
      ],
      count: 1,
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        pinnedObservation: {
          catalogNumber: 'PIN-LABEL',
          lat: 40.2,
          lon: -105.1,
        },
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());
    await waitFor(() => expect(result.current.pinnedValue).toBe('Forest'));

    expect(result.current.pinnedCategoryValue).toBe('forest');
    expect(result.current.pinnedUnobservedCategory).toBeNull();
  });

  it('surfaces an unobserved categorical badge when point lookup only returns a label', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...categoricalStats,
      categoricalDistribution: [
        { value: 'forest', className: 'Forest', count: 3, fraction: 0.6 },
        { value: 'grassland', className: 'Grassland', count: 2, fraction: 0.4 },
      ],
    });
    mockFetchPointEnvironmentValue.mockResolvedValue({
      variable: 'landcover',
      units: null,
      lat: 40.2,
      lon: -105.1,
      value: 'Urban',
      valueLabel: 'Urban',
      valueDescription: 'Developed land',
    });
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
      speciesId: 1,
      variable: 'landcover',
      classValue: 'Urban',
      observations: [],
      count: 0,
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        pinnedObservation: {
          catalogNumber: 'PIN-LABEL-OOD',
          lat: 40.2,
          lon: -105.1,
        },
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());
    await waitFor(() => expect(result.current.pinnedValue).toBe('Urban'));

    expect(result.current.pinnedCategoryValue).toBeNull();
    expect(result.current.pinnedUnobservedCategory).toEqual({
      value: 'Urban',
      label: 'Urban',
      description: 'Developed land',
    });
  });

  it('prefers category sample results over distribution fallback for pinned categorical badges', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...categoricalStats,
      categoricalDistribution: [
        { value: 90, className: 'Urban', count: 3, fraction: 0.6 },
        { value: 52, className: 'Grassland', count: 2, fraction: 0.4 },
      ],
    });
    mockFetchPointEnvironmentValue.mockResolvedValue({
      variable: 'landcover',
      units: null,
      lat: 40.2,
      lon: -105.1,
      value: 90,
      valueLabel: 'Urban',
      valueDescription: 'Developed land',
    });
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
      speciesId: 1,
      variable: 'landcover',
      classValue: 90,
      observations: [],
      count: 0,
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        pinnedObservation: {
          catalogNumber: 'PIN-PRECEDENCE',
          lat: 40.2,
          lon: -105.1,
        },
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());
    await waitFor(() => expect(result.current.pinnedValue).toBe(90));
    await waitFor(() =>
      expect(result.current.pinnedUnobservedCategory).toEqual({
        value: 90,
        label: 'Urban',
        description: 'Developed land',
      }),
    );
  });

  it('uses the categorical class label for observation checks when point lookup returns a raster class id', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...categoricalStats,
      categoricalDistribution: [
        { value: 'forest', className: 'Forest', count: 3, fraction: 0.6 },
        { value: 'grassland', className: 'Grassland', count: 2, fraction: 0.4 },
      ],
      categoricalSamples: [
        { value: 'forest', observationIds: ['A1', 'B2'] },
        { value: 'grassland', observationIds: ['C3'] },
      ],
    });
    mockFetchPointEnvironmentValue.mockResolvedValue({
      variable: 'landcover',
      units: 'class id',
      lat: 44.134913443750726,
      lon: -84.79248046875001,
      value: 62,
      valueLabel: 'Closed deciduous broadleaved forest',
      valueDescription: null,
    });
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
      speciesId: 1,
      variable: 'landcover',
      classValue: 'Closed deciduous broadleaved forest',
      observations: [],
      count: 0,
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        pinnedObservation: {
          catalogNumber: 'PIN-REAL-PAYLOAD',
          lat: 44.134913443750726,
          lon: -84.79248046875001,
        },
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());
    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledWith(
        1,
        'landcover',
        'Closed deciduous broadleaved forest',
        { location: undefined, units: undefined },
      ),
    );
    await waitFor(() =>
      expect(result.current.pinnedUnobservedCategory).toEqual({
        value: 62,
        label: 'Closed deciduous broadleaved forest',
        description: null,
      }),
    );
  });

  it('supports location filter mode and clears rank contexts', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        locationGid: 'USA.1_1',
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());

    expect(result.current.locationFilterActive).toBe(true);
    expect(result.current.showRankContext).toBe(false);
    expect(result.current.rankContextOptions).toEqual([]);
  });

  it('surfaces environment stats fetch errors', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockRejectedValue(new Error('stats failed'));

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.error).toBe('stats failed'));
  });

  it('rejects malformed histogram payloads from API at boundary', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...continuousStats,
      histogram: {
        bins: [0, Number.NaN, 20],
        counts: [10, 10],
      },
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() =>
      expect(result.current.error).toBe(
        'Received malformed histogram data from environment API',
      ),
    );
    expect(result.current.stats).toBeNull();
  });

  it('clears highlights when density selection is reset', async () => {
    const onHighlightChange = jest.fn();
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        onHighlightChange,
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());

    act(() => {
      result.current.handleDensitySelectionChange({ start: 1, end: 2 });
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
    );

    act(() => {
      result.current.handleDensitySelectionChange(null);
    });
    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
  });

  it('handles categorical sample API errors', async () => {
    const onHighlightChange = jest.fn();
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...categoricalStats,
      categoricalSamples: [],
    });
    mockFetchSpeciesEnvironmentCategorySamples.mockRejectedValue(
      new Error('samples failed'),
    );

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        onHighlightChange,
        variables: categoricalVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.isCategorical).toBe(true));

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalled(),
    );
    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
  });

  it('does not fetch stats when taxonId is missing', async () => {
    renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: undefined,
        variableId: 'bio_1',
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => {
      expect(mockFetchSpeciesEnvironment).not.toHaveBeenCalled();
    });
  });

  it('derives selected category and variable from provided categories', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: '',
        variables: [
          {
            id: 'bio_2',
            label: 'Temp 2',
            category: 'Zeta',
            valueType: 'continuous',
            units: 'C',
          },
          {
            id: 'bio_1',
            label: 'Temp 1',
            category: 'Alpha',
            valueType: 'continuous',
            units: 'C',
          },
        ],
      }),
    );

    await waitFor(() => {
      expect(result.current.categories).toEqual(['Alpha', 'Zeta']);
      expect(result.current.selectedVariableCategory).toBe('Alpha');
      expect(result.current.selectedVariable).toBe('bio_1');
    });
  });

  it('updates category and fallback variable together when switching categories', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        variables: [
          {
            id: 'bio_1',
            label: 'Temp 1',
            category: 'Climate',
            valueType: 'continuous',
            units: 'C',
          },
          {
            id: 'bio_12',
            label: 'Annual Rain',
            category: 'Rainfall',
            valueType: 'continuous',
            units: 'mm',
          },
        ],
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedVariableCategory).toBe('Climate');
      expect(result.current.selectedVariable).toBe('bio_1');
    });

    act(() => {
      result.current.setSelectedVariableCategory('Rainfall');
    });

    await waitFor(() => {
      expect(result.current.selectedVariableCategory).toBe('Rainfall');
      expect(result.current.selectedVariable).toBe('bio_12');
    });

    await waitFor(() => {
      expect(mockFetchSpeciesEnvironment).toHaveBeenCalledWith(1, 'bio_12', {
        location: undefined,
        units: undefined,
      });
      expect(result.current.loading).toBe(false);
    });
  });

  it('computes histogram fallback ranks when relative ranks are unavailable', async () => {
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...continuousStats,
      relativeRanks: [],
      histogram: { bins: [0, 10, 20], counts: [5, 5] },
      summary: {
        count: 10,
        min: 1,
        mean: 10,
        max: 19,
        stddev: 2,
        q01: 2,
        q99: 18,
      },
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());

    expect(result.current.summaryRanks.mean?.label).toBe('Distribution');
    expect(typeof result.current.summaryRanks.mean?.percentile).toBe('number');
    expect(result.current.summaryRanks.std).toBeNull();
    expect(result.current.summaryRanks.range99).toBeNull();
  });

  it('builds baseline comparisons in location filter mode', async () => {
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...continuousStats,
      summary: {
        count: 10,
        min: 1,
        mean: 8,
        max: 12,
        stddev: 2,
        q01: 2,
        q99: 11,
      },
      baselineSummary: {
        count: 100,
        min: 0,
        mean: 10,
        max: 20,
        stddev: 4,
        q01: 1,
        q99: 19,
      },
    });

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        locationGid: 'USA.1_1',
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());

    expect(result.current.locationFilterActive).toBe(true);
    expect(result.current.summaryComparisons.mean).toContain('vs');
    expect(result.current.summaryComparisons.range99).toContain('vs');
  });

  it('fetches category samples with location filter when categorical samples are not preloaded', async () => {
    const onHighlightChange = jest.fn();
    mockFetchSpeciesEnvironment.mockResolvedValue({
      ...categoricalStats,
      categoricalSamples: [{ value: 'forest', observationIds: ['LOCAL-A'] }],
    });
    mockFetchSpeciesEnvironmentCategorySamples.mockResolvedValue({
      speciesId: 1,
      variable: 'landcover',
      classValue: 'forest',
      count: 1,
      observations: [
        { catalogNumber: 'REMOTE-1', value: null, latitude: 0, longitude: 0 },
      ],
    } satisfies SpeciesEnvironmentCategorySampleResponse);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        locationGid: 'USA.1_1',
        onHighlightChange,
        variables: categoricalVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.isCategorical).toBe(true));

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalled(),
    );
    expect(mockFetchSpeciesEnvironmentCategorySamples).toHaveBeenCalledWith(
      1,
      'landcover',
      'forest',
      { location: 'USA.1_1' },
    );
    expect(onHighlightChange).toHaveBeenCalled();
  });

  it('does not fetch category samples when preloaded categorical samples are available', async () => {
    const onHighlightChange = jest.fn();
    mockFetchSpeciesEnvironment.mockResolvedValue(categoricalStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'landcover',
        onHighlightChange,
        variables: categoricalVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.isCategorical).toBe(true));

    act(() => {
      result.current.setSelectedCategoryValue('forest');
    });

    await waitFor(() =>
      expect(onHighlightChange).toHaveBeenCalledWith(['A1', 'B2']),
    );
    expect(mockFetchSpeciesEnvironmentCategorySamples).not.toHaveBeenCalled();
  });

  it('clears highlights when range slice fetch fails', async () => {
    const onHighlightChange = jest.fn();
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);
    mockFetchEnvironmentRangeSlice.mockRejectedValue(new Error('range failed'));

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        onHighlightChange,
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());

    act(() => {
      result.current.handleDensitySelectionChange({ start: 3, end: 7 });
    });

    await waitFor(() =>
      expect(mockFetchEnvironmentRangeSlice).toHaveBeenCalled(),
    );
    await waitFor(() => expect(onHighlightChange).toHaveBeenCalledWith([]));
  });

  it('updates meta text for active density selection', async () => {
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);
    mockFetchEnvironmentRangeSlice.mockResolvedValue({
      speciesId: 1,
      variable: 'bio_1',
      range: { min: 2, max: 5 },
      limit: null,
      count: 2,
      observations: [
        { catalogNumber: 1, value: 2.1, latitude: 0, longitude: 0 },
        { catalogNumber: 2, value: 4.8, latitude: 0, longitude: 0 },
      ],
    } satisfies SpeciesEnvironmentSliceResponse);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());

    act(() => {
      result.current.handleDensitySelectionChange({ start: 2, end: 5 });
    });

    await waitFor(() => {
      expect(result.current.metaText).toContain('Selected range:');
      expect(result.current.metaText).toContain('2 of 20 observations');
    });
  });

  it('uses observationCount for circular variables when summary stats are intentionally omitted', async () => {
    mockFetchSpeciesEnvironment.mockResolvedValue({
      speciesId: 1,
      variable: 'aspect_deg',
      variableName: 'Aspect',
      units: 'degrees',
      variableType: 'circular',
      observationCount: 12,
      summary: {
        count: 0,
        min: null,
        mean: null,
        max: null,
        q01: null,
        q99: null,
      },
      histogram: null,
      densityCurve: { points: [0, 180, 360], density: [0.2, 0.8, 0.2] },
      relativeRanks: [],
    } satisfies SpeciesEnvironmentStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'aspect_deg',
        variables: [
          {
            id: 'aspect_deg',
            label: 'Aspect (degrees)',
            units: 'degrees',
            valueType: 'circular',
            category: 'Terrain',
          },
        ],
      }),
    );

    await waitFor(() => expect(result.current.stats).toBeTruthy());
    expect(result.current.metaText).toContain('(Based on 12 observations)');
  });

  it('preserves selected category and variable when updated variable lists still contain them', async () => {
    mockFetchEnvironmentVariables.mockResolvedValue(variableCatalog);
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);

    const initialVariables: EnvironmentVariableOption[] = [
      {
        id: 'bio_1',
        label: 'Temp 1',
        category: 'Alpha',
        valueType: 'continuous',
        units: 'C',
      },
      {
        id: 'bio_2',
        label: 'Temp 2',
        category: 'Alpha',
        valueType: 'continuous',
        units: 'C',
      },
      {
        id: 'bio_9',
        label: 'Temp 9',
        category: 'Zeta',
        valueType: 'continuous',
        units: 'C',
      },
    ];

    const { result, rerender } = renderHook(
      ({ variables }: { variables: EnvironmentVariableOption[] }) =>
        useSpeciesEnvironmentState({
          taxonId: 1,
          variableId: 'bio_1',
          variables,
        }),
      { initialProps: { variables: initialVariables } },
    );

    await waitFor(() => {
      expect(result.current.selectedVariableCategory).toBe('Alpha');
      expect(result.current.selectedVariable).toBe('bio_1');
    });

    act(() => {
      result.current.setSelectedVariable('bio_2');
      result.current.setSelectedVariableCategory('Alpha');
    });

    const updatedVariables: EnvironmentVariableOption[] = [
      {
        id: 'bio_3',
        label: 'Temp 3',
        category: 'Alpha',
        valueType: 'continuous',
        units: 'C',
      },
      {
        id: 'bio_2',
        label: 'Temp 2',
        category: 'Alpha',
        valueType: 'continuous',
        units: 'C',
      },
      {
        id: 'bio_9',
        label: 'Temp 9',
        category: 'Zeta',
        valueType: 'continuous',
        units: 'C',
      },
    ];

    rerender({ variables: updatedVariables });

    await waitFor(() => {
      expect(result.current.selectedVariableCategory).toBe('Alpha');
      expect(result.current.selectedVariable).toBe('bio_2');
    });
  });

  it('keeps valid selected rank context and falls back to first option when invalid', async () => {
    mockFetchSpeciesEnvironment.mockResolvedValue(continuousStats);

    const { result } = renderHook(() =>
      useSpeciesEnvironmentState({
        taxonId: 1,
        variableId: 'bio_1',
        variables: continuousVariableOptions,
      }),
    );

    await waitFor(() => {
      expect(result.current.rankContextOptions.length).toBeGreaterThan(0);
      expect(result.current.selectedRankContext).toBe(
        result.current.rankContextOptions[0].key,
      );
    });

    act(() => {
      result.current.setSelectedRankContext('Mammalia');
    });

    await waitFor(() => {
      expect(result.current.selectedRankContext).toBe('Mammalia');
    });

    act(() => {
      result.current.setSelectedRankContext('InvalidContext');
    });

    await waitFor(() => {
      expect(result.current.selectedRankContext).toBe(
        result.current.rankContextOptions[0].key,
      );
    });
  });
});
