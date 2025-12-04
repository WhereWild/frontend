import { fetchSpeciesByTaxonId, fetchSpeciesEnvironment } from '@/data/api';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesEnvironmentStats } from '@/data/types';
import { DEFAULT_MEASUREMENT_UNITS } from '@/constants/userPreferences';
import { useMeasurementPreferences } from '@/hooks/useMeasurementPreferences';
import { act, render, screen } from '@testing-library/react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SpeciesPage from '../../_speciesPage';
import SpeciesBasicsPage, { __SPECIES_BASICS_TESTING__ } from '../[...identifier]';

jest.mock('@/components/sections/SpeciesEnvironmentSection', () => ({
  __esModule: true,
  SpeciesEnvironmentSection: jest.fn(() => null),
}));

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    useLocalSearchParams: jest.fn(),
    useRouter: jest.fn(),
    usePathname: jest.fn(),
  };
});

jest.mock('@/data/api', () => ({
  fetchSpeciesByTaxonId: jest.fn(),
  fetchSpeciesEnvironment: jest.fn(),
}));

jest.mock('../../_speciesPage', () => {
  const actual = jest.requireActual('../../_speciesPage');
  const SpeciesPageActual = actual.default;
  const WrappedSpeciesPage = jest.fn((props) => SpeciesPageActual(props));
  return WrappedSpeciesPage;
});

jest.mock('@/hooks/useMeasurementPreferences', () => ({
  useMeasurementPreferences: jest.fn(() => ({
    lengthUnits: 'metric',
    rainfallUnits: 'metric',
    temperatureUnits: 'celsius',
    setLengthUnits: jest.fn(),
    setRainfallUnits: jest.fn(),
    setTemperatureUnits: jest.fn(),
    resetLengthUnits: jest.fn(),
    resetRainfallUnits: jest.fn(),
    resetTemperatureUnits: jest.fn(),
    snapshot: {
      lengthUnits: 'metric',
      rainfallUnits: 'metric',
      temperatureUnits: 'celsius',
    },
  })),
}));

const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockFetchSpeciesByTaxonId = fetchSpeciesByTaxonId as jest.MockedFunction<typeof fetchSpeciesByTaxonId>;
const mockFetchSpeciesEnvironment = fetchSpeciesEnvironment as jest.MockedFunction<typeof fetchSpeciesEnvironment>;
const mockSpeciesPage = SpeciesPage as jest.MockedFunction<typeof SpeciesPage>;
const mockUseSafeAreaInsets = useSafeAreaInsets as jest.MockedFunction<typeof useSafeAreaInsets>;
const mockUseMeasurementPreferences = useMeasurementPreferences as jest.MockedFunction<typeof useMeasurementPreferences>;

const flushMicrotasksQueue = () => new Promise((resolve) => setImmediate(resolve));

const createRouterMock = () => ({
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn(),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  dismissTo: jest.fn(),
  refresh: jest.fn(),
} as unknown as ReturnType<typeof useRouter>);

const getLatestRenderProps = () => {
  const call = mockSpeciesPage.mock.calls[mockSpeciesPage.mock.calls.length - 1];
  return call?.[0];
};

const SAMPLE_TAXON_ID = '123456';

describe('SpeciesBasicsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(createRouterMock());
    mockUsePathname.mockReturnValue('/');
    mockUseSafeAreaInsets.mockReset();
    mockUseSafeAreaInsets.mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    mockUseMeasurementPreferences.mockReturnValue({
      lengthUnits: 'metric',
      rainfallUnits: 'metric',
      temperatureUnits: 'celsius',
      setLengthUnits: jest.fn(),
      setRainfallUnits: jest.fn(),
      setTemperatureUnits: jest.fn(),
      resetLengthUnits: jest.fn(),
      resetRainfallUnits: jest.fn(),
      resetTemperatureUnits: jest.fn(),
      snapshot: {
        lengthUnits: 'metric',
        rainfallUnits: 'metric',
        temperatureUnits: 'celsius',
      },
    });
    mockFetchSpeciesEnvironment.mockImplementation(async (taxonId, variableId) => ({
      speciesId: Number(taxonId ?? SAMPLE_TAXON_ID),
      variable: String(variableId),
      variableName: String(variableId),
      units: 'units',
      variableType: 'continuous',
      generatedAt: '2024-01-01T00:00:00Z',
      summary: {
        count: 42,
        mean: 12,
        stddev: 3,
        q10: 4,
        q90: 20,
      },
      histogram: { bins: [0, 10, 20], counts: [10, 32] },
      binSamples: [],
      categoricalDistribution: [],
      dominantCategories: [],
      categoricalSamples: [],
    }));
  });

  it('renders fallback data when no identifier parameter is supplied', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    mockUseLocalSearchParams.mockReturnValue({});

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalled();
    expect(mockSpeciesPage).toHaveBeenCalled();
    expect(getLatestRenderProps()?.data).toEqual(mountainBallCactusData);
    expect(screen.queryAllByText(mountainBallCactusData.commonName).length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });

  it('fetches species basics and maps the response onto SpeciesPage props', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Snowy Owl',
      scientific_name: 'Bubo scandiacus',
      description: 'Large white owl adapted to Arctic climates.',
      image_url: 'https://example.com/owl.png',
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(SAMPLE_TAXON_ID);
    await screen.findByText('Snowy Owl');
    await screen.findByText('Large white owl adapted to Arctic climates.');
  });

  it('hydrates environmental data sections from backend stats', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      taxon_id: Number(SAMPLE_TAXON_ID),
      common_name: 'Data-rich species',
      scientific_name: 'Statistica foobar',
      description: 'Has field data.',
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });
    await act(async () => {
      await flushMicrotasksQueue();
    });

    const expectedCalls = __SPECIES_BASICS_TESTING__.ENVIRONMENT_VARIABLE_TARGETS.length;
    expect(mockFetchSpeciesEnvironment).toHaveBeenCalledTimes(expectedCalls);
    __SPECIES_BASICS_TESTING__.ENVIRONMENT_VARIABLE_TARGETS.forEach(({ variableId }, index) => {
      expect(mockFetchSpeciesEnvironment).toHaveBeenNthCalledWith(
        index + 1,
        Number(SAMPLE_TAXON_ID),
        variableId,
      );
    });

    const props = getLatestRenderProps();
    const sections = props?.data?.dataSections;
    const entries = sections?.[0]?.entries ?? [];
    expect(entries).toHaveLength(expectedCalls);

    entries.forEach((entry, index) => {
      const target = __SPECIES_BASICS_TESTING__.ENVIRONMENT_VARIABLE_TARGETS[index];
      expect(entry.environmentGraph?.initialStats).toEqual(
        expect.objectContaining({
          speciesId: Number(SAMPLE_TAXON_ID),
          variable: target.variableId,
          summary: expect.objectContaining({
            count: 42,
            mean: 12,
            stddev: 3,
            q10: 4,
            q90: 20,
          }),
        }),
      );
    });
  });

  it('falls back to sample data when the fetch request fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockRejectedValue(new Error('Network down'));

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(SAMPLE_TAXON_ID);
    expect(mockSpeciesPage).toHaveBeenCalled();
    await screen.findByText(mountainBallCactusData.commonName);
    expect(consoleSpy).toHaveBeenCalledWith(
      `Failed to load species '${SAMPLE_TAXON_ID}':`,
      'Network down',
    );

    consoleSpy.mockRestore();
  });

  it('logs the default failure message when the rejection is not an Error instance', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockRejectedValue('uh oh');

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      `Failed to load species '${SAMPLE_TAXON_ID}':`,
      'Failed to load species',
    );
    consoleSpy.mockRestore();
  });

  it('falls back to sample data when the API returns null for a valid identifier', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue(null as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(SAMPLE_TAXON_ID);
    await screen.findByText(mountainBallCactusData.commonName);
  });

  it('prefers image_source strings returned by the API over image_url', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Seaside Daisy',
      scientific_name: 'Erigeron glaucus',
      description: 'Coastal perennial with lavender petals.',
      image_source: 'https://example.com/preferred.png',
      image_url: 'https://example.com/should-not-use.png',
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    const props = getLatestRenderProps();
    expect(props?.data?.overview?.imageSource).toEqual({ uri: 'https://example.com/preferred.png' });
  });

  it('uses the provided React Native image source object when supplied', async () => {
    const providedSource = { uri: 'https://example.com/kept.png' } as const;
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Forest Fern',
      scientific_name: 'Dryopteris expansa',
      description: 'Shade-tolerant fern with lush fronds.',
      image_source: providedSource,
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    const props = getLatestRenderProps();
    expect(props?.data?.overview?.imageSource).toBe(providedSource);
  });

  it('renders fallback content while the identifier data is still loading', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockReturnValue(new Promise(() => { }));

    render(<SpeciesBasicsPage />);

    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockSpeciesPage).not.toHaveBeenCalled();
    expect(screen.getByText('Active Near You')).toBeTruthy();
  });

  it('falls back to the sample overview image when no image fields are provided', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Faceless Flora',
      scientific_name: 'Nulla imago',
      description: 'Species reported without image metadata.',
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    const props = getLatestRenderProps();
    expect(props?.data?.overview?.imageSource).toBe(mountainBallCactusData.overview?.imageSource);
  });

  it('ignores late success responses after unmounting', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    let resolveFetch: (value: any) => void = () => { };
    const pendingFetch = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    mockFetchSpeciesByTaxonId.mockReturnValue(pendingFetch as any);

    const { unmount } = render(<SpeciesBasicsPage />);
    const initialRenderCount = mockSpeciesPage.mock.calls.length;
    unmount();

    await act(async () => {
      resolveFetch({
        common_name: 'Lagging Fern',
        scientific_name: 'Fernus tardus',
        description: 'Arrives after the component unmounts.',
      });
      await flushMicrotasksQueue();
    });

    expect(mockSpeciesPage.mock.calls.length).toBe(initialRenderCount);
  });

  it('ignores late error responses after unmounting', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    let rejectFetch: (reason?: unknown) => void = () => { };
    const pendingFetch = new Promise((_, reject) => {
      rejectFetch = reject;
    });
    mockFetchSpeciesByTaxonId.mockReturnValue(pendingFetch as any);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const { unmount } = render(<SpeciesBasicsPage />);
    const initialRenderCount = mockSpeciesPage.mock.calls.length;
    unmount();

    await act(async () => {
      rejectFetch(new Error('Delayed failure'));
      await flushMicrotasksQueue();
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(mockSpeciesPage.mock.calls.length).toBe(initialRenderCount);

    consoleSpy.mockRestore();
  });

  it('prioritizes taxon id identifiers when provided via path segments', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: ['1234', 'strix-nebulosa'] });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Great Gray Owl',
      scientific_name: 'Strix nebulosa',
      description: 'Large gray owl.',
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith('1234');
  });

  it('logs an error and renders fallback data when the identifier is non-numeric', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockUseLocalSearchParams.mockReturnValue({ identifier: 'invalid identifier' });

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalled();
    expect(mockSpeciesPage).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Missing numeric taxon ID in route segments.');

    consoleSpy.mockRestore();
  });

  describe('__SPECIES_BASICS_TESTING__ helpers', () => {
    const createStats = (
      overrides: Partial<SpeciesEnvironmentStats> = {},
    ): SpeciesEnvironmentStats => {
      const { summary: summaryOverride, ...rest } = overrides;
      const summary = {
        count: 120,
        mean: 820.5,
        stddev: 42.3,
        q10: 640.1,
        q90: 963.8,
        min: 512.3,
        max: 1684.2,
        ...summaryOverride,
      };

      const base: SpeciesEnvironmentStats = {
        speciesId: 4242,
        variable: 'elevation',
        variableName: 'Elevation',
        units: 'm',
        variableType: 'continuous',
        generatedAt: '2024-01-01T00:00:00Z',
        summary,
        histogram: { bins: [0, 10, 20], counts: [12, 18] },
        binSamples: [],
        categoricalDistribution: [],
        dominantCategories: [],
        categoricalSamples: [],
      };

      return {
        ...base,
        ...rest,
        summary,
      };
    };

    it('builds SpeciesPageData with payload overrides', () => {
      const payload = {
        taxon_id: 24680,
        common_name: 'Prairie Smoke',
        scientific_name: 'Geum triflorum',
        description: 'Feathery seed-heads add spring interest.',
        image_source: 'https://example.com/prairie-smoke.png',
      } as any;

      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(payload, 13579);
      expect(result.taxonId).toBe(24680);
      expect(result.commonName).toBe('Prairie Smoke');
      expect(result.scientificName).toBe('Geum triflorum');
      expect(result.overview?.description).toBe(payload.description);
      expect(result.overview?.imageSource).toEqual({ uri: 'https://example.com/prairie-smoke.png' });
      expect(result.dataSections).toEqual(mountainBallCactusData.dataSections);
    });

    it('uses the requested taxon id when payload lacks taxon data', () => {
      const fallbackTaxonId = 97531;
      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData({}, fallbackTaxonId as any);
      expect(result.taxonId).toBe(fallbackTaxonId);
      expect(result.commonName).toBe('Mountain Ball Cactus');
      expect(result.scientificName).toBe('Pediocactus simpsonii');
    });

    it('derives identifier priorities from route params', () => {
      const params = {
        identifier: ['9876', 'encoded-sci'],
        taxonId: '1111',
      };

      const { fetchIdentifier, requestedTaxonId } = __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBe('9876');
      expect(requestedTaxonId).toBe(9876);
    });

    it('returns undefined when taxon identifiers are unavailable', () => {
      const params = {
        identifier: ['Invalid ID'],
      };

      const { fetchIdentifier, requestedTaxonId } = __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBeUndefined();
      expect(requestedTaxonId).toBeUndefined();
    });

    it('ignores empty identifier segments altogether', () => {
      const params = {
        identifier: ['', '   '],
      };

      const { fetchIdentifier, requestedTaxonId } = __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBeUndefined();
      expect(requestedTaxonId).toBeUndefined();
    });

    it('trims whitespace before validating numeric identifier segments', () => {
      const params = {
        identifier: ['   654321   ', 'trailing-slug'],
      };

      const { fetchIdentifier, requestedTaxonId } = __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBe('654321');
      expect(requestedTaxonId).toBe(654321);
    });

    it('normalizes image sources across string, RN source, and url payloads', () => {
      const stringSource = __SPECIES_BASICS_TESTING__.normalizeImageSource({
        image_source: 'https://example.com/direct.png',
      } as any);
      expect(stringSource).toEqual({ uri: 'https://example.com/direct.png' });

      const rnSource = { uri: 'https://example.com/rn-object.png' } as const;
      const objectSource = __SPECIES_BASICS_TESTING__.normalizeImageSource({
        image_source: rnSource,
      } as any);
      expect(objectSource).toBe(rnSource);

      const fallback = __SPECIES_BASICS_TESTING__.normalizeImageSource({
        image_url: 'https://example.com/fallback.png',
      } as any);
      expect(fallback).toEqual({ uri: 'https://example.com/fallback.png' });

      expect(__SPECIES_BASICS_TESTING__.normalizeImageSource({} as any)).toBeUndefined();
    });

    it('builds environment entries with resolved summary details', () => {
      const stats = createStats({
        dominantCategories: [
          { value: 1, className: 'Forest', count: 40, fraction: 0.5 },
        ],
      });

      const entry = __SPECIES_BASICS_TESTING__.buildEnvironmentEntry(
        stats,
        'Fallback label',
        DEFAULT_MEASUREMENT_UNITS,
      );
      expect(entry).not.toBeNull();
      expect(entry?.dataName).toBe('Elevation');
      expect(entry?.environmentGraph?.initialStats).toBe(stats);
      expect(entry?.details).toEqual(
        expect.arrayContaining([
          { label: 'Samples', value: '120' },
          { label: 'Mean', value: '821 m' },
          { label: 'Std dev', value: '42.3 m' },
          { label: 'Central range', value: '640 m to 964 m' },
          expect.objectContaining({ label: 'Forest' }),
        ]),
      );
    });

    it('summarizes categorical distributions by unique class count', () => {
      const stats = createStats({
        variableType: 'categorical',
        summary: { count: 25, mean: null, stddev: null, q10: null, q90: null, min: null, max: null },
        categoricalDistribution: [
          { value: 1, className: 'Forest', count: 10, fraction: 0.4 },
          { value: 2, className: 'Shrubland', count: 15, fraction: 0.6 },
        ],
      });

      const entry = __SPECIES_BASICS_TESTING__.buildEnvironmentEntry(
        stats,
        'Fallback label',
        DEFAULT_MEASUREMENT_UNITS,
      );

      expect(entry?.dataPoint).toContain('2 unique classes');
      expect(entry?.dataPoint).toContain('25 samples');
    });

    it('falls back to the provided label when variable metadata is missing', () => {
      const stats = createStats({
        variableName: '',
        summary: {
          count: 10,
          mean: null,
          stddev: null,
          q10: null,
          q90: null,
          min: null,
          max: null,
        },
        dominantCategories: [],
        categoricalDistribution: [{ value: 3, className: 'Shrubland', count: 10, fraction: 1 }],
      });

      const entry = __SPECIES_BASICS_TESTING__.buildEnvironmentEntry(
        stats,
        'Fallback label',
        DEFAULT_MEASUREMENT_UNITS,
      );
      expect(entry?.dataName).toBe('Fallback label');
      expect(entry?.dataPoint).toContain('1 unique classes (10 samples)');
    });

    it('skips environment entries without sample data and prunes empty sections', () => {
      const emptyStats = createStats({
        summary: { count: 0, mean: null, stddev: null, q10: null, q90: null, min: null, max: null },
        dominantCategories: [],
        categoricalDistribution: [],
      });

      const entry = __SPECIES_BASICS_TESTING__.buildEnvironmentEntry(
        emptyStats,
        'Unavailable',
        DEFAULT_MEASUREMENT_UNITS,
      );
      expect(entry).toBeNull();

      const sections = __SPECIES_BASICS_TESTING__.buildEnvironmentSections(
        [{ stats: emptyStats, fallbackLabel: 'Unused' }],
        DEFAULT_MEASUREMENT_UNITS,
      );
      expect(sections).toEqual([]);

      const stats = createStats();
      const populatedSections = __SPECIES_BASICS_TESTING__.buildEnvironmentSections(
        [{ stats, fallbackLabel: 'Primary' }],
        DEFAULT_MEASUREMENT_UNITS,
      );
      expect(populatedSections).toHaveLength(1);
      expect(populatedSections[0].title).toBe('Environmental Factors');
      expect(populatedSections[0].entries[0].dataName).toBe(stats.variableName);
    });

    it('resolves summary descriptions based on available statistics', () => {
      const quantileStats = createStats();
      expect(
        __SPECIES_BASICS_TESTING__.resolveSummaryDescription(quantileStats),
      ).toContain('to');

      const meanStats = createStats({
        summary: { count: 12, mean: 15.5, stddev: null, q10: null, q90: null, min: null, max: null },
        dominantCategories: [],
      });
      expect(
        __SPECIES_BASICS_TESTING__.resolveSummaryDescription(meanStats),
      ).toContain('average');

      const categoryStats = createStats({
        summary: { count: 0, mean: null, stddev: null, q10: null, q90: null, min: null, max: null },
        dominantCategories: [
          { value: 1, className: 'Wetland', count: 5, fraction: 0.5 },
        ],
      });
      expect(
        __SPECIES_BASICS_TESTING__.resolveSummaryDescription(categoryStats),
      ).toContain('Wetland');

      const samplesOnly = createStats({
        summary: { count: 7, mean: null, stddev: null, q10: null, q90: null, min: null, max: null },
        dominantCategories: [],
      });
      expect(
        __SPECIES_BASICS_TESTING__.resolveSummaryDescription(samplesOnly),
      ).toBe('7 samples recorded');

      const insufficient = createStats({
        summary: { count: 0, mean: null, stddev: null, q10: null, q90: null, min: null, max: null },
        dominantCategories: [],
        categoricalDistribution: [],
      });
      expect(
        __SPECIES_BASICS_TESTING__.resolveSummaryDescription(insufficient),
      ).toBe('Not enough samples yet');
    });
  });
});
