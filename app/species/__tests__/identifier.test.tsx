import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import SpeciesBasicsPage, { __SPECIES_BASICS_TESTING__ } from '../[...identifier]';
import { mountainBallCactusData } from '@/data/speciesSample';
import { useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import { fetchSpeciesByTaxonId } from '@/data/api';
import SpeciesPage from '../../_speciesPage';

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
}));

jest.mock('../../_speciesPage', () => {
  const actual = jest.requireActual('../../_speciesPage');
  const SpeciesPageActual = actual.default;
  const WrappedSpeciesPage = jest.fn((props) => SpeciesPageActual(props));
  return WrappedSpeciesPage;
});

const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockFetchSpeciesByTaxonId = fetchSpeciesByTaxonId as jest.MockedFunction<typeof fetchSpeciesByTaxonId>;
const mockSpeciesPage = SpeciesPage as jest.MockedFunction<typeof SpeciesPage>;

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
    expect(props?.data?.overview.imageSource).toEqual({ uri: 'https://example.com/preferred.png' });
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
    expect(props?.data?.overview.imageSource).toBe(providedSource);
  });

  it('renders nothing while the identifier data is still loading', () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockReturnValue(new Promise(() => { }));

    const { toJSON } = render(<SpeciesBasicsPage />);

    expect(mockSpeciesPage).not.toHaveBeenCalled();
    expect(toJSON()).toBeNull();
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
    expect(props?.data?.overview.imageSource).toBe(mountainBallCactusData.overview.imageSource);
  });

  it('ignores late success responses after unmounting', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    let resolveFetch: (value: any) => void = () => { };
    const pendingFetch = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    mockFetchSpeciesByTaxonId.mockReturnValue(pendingFetch as any);

    const { unmount } = render(<SpeciesBasicsPage />);
    unmount();

    await act(async () => {
      resolveFetch({
        common_name: 'Lagging Fern',
        scientific_name: 'Fernus tardus',
        description: 'Arrives after the component unmounts.',
      });
      await flushMicrotasksQueue();
    });

    expect(mockSpeciesPage).not.toHaveBeenCalled();
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
    unmount();

    await act(async () => {
      rejectFetch(new Error('Delayed failure'));
      await flushMicrotasksQueue();
    });

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(mockSpeciesPage).not.toHaveBeenCalled();

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
    mockUseLocalSearchParams.mockReturnValue({ identifier: 'slug-only' });

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalled();
    expect(mockSpeciesPage).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Missing numeric taxon ID in route parameters. Received:',
      { identifier: 'slug-only', taxonId: undefined },
    );

    consoleSpy.mockRestore();
  });

  describe('__SPECIES_BASICS_TESTING__ helpers', () => {
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
      expect(result.overview.description).toBe(payload.description);
      expect(result.overview.imageSource).toEqual({ uri: 'https://example.com/prairie-smoke.png' });
      expect(result.dataSections).toBe(mountainBallCactusData.dataSections);
    });

    it('uses the requested taxon id when payload lacks taxon data', () => {
      const fallbackTaxonId = 97531;
      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData({}, fallbackTaxonId as any);
      expect(result.taxonId).toBe(fallbackTaxonId);
      expect(result.commonName).toBe(mountainBallCactusData.commonName);
      expect(result.scientificName).toBe(mountainBallCactusData.scientificName);
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
        identifier: ['only-slug'],
      };

      const { fetchIdentifier, requestedTaxonId } = __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBeUndefined();
      expect(requestedTaxonId).toBeUndefined();
    });
  });
});
