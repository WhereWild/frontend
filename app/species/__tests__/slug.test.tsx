import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import SpeciesBasicsPage, { __SPECIES_BASICS_TESTING__ } from '../[slug]';
import { mountainBallCactusData } from '@/data/speciesSample';
import { useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import { fetchSpeciesBySlug } from '@/data/api';
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
  fetchSpeciesBySlug: jest.fn(),
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
const mockFetchSpeciesBySlug = fetchSpeciesBySlug as jest.MockedFunction<typeof fetchSpeciesBySlug>;
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

describe('SpeciesBasicsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(createRouterMock());
    mockUsePathname.mockReturnValue('/');
  });

  it('renders fallback data when slug parameter is missing', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockUseLocalSearchParams.mockReturnValue({});

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesBySlug).not.toHaveBeenCalled();
    expect(mockSpeciesPage).toHaveBeenCalled();
    expect(getLatestRenderProps()?.data).toEqual(mountainBallCactusData);
    expect(screen.queryAllByText(mountainBallCactusData.commonName).length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });

  it('fetches species basics and maps the response onto SpeciesPage props', async () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'snowy-owl' });
    mockFetchSpeciesBySlug.mockResolvedValue({
      common_name: 'Snowy Owl',
      scientific_name: 'Bubo scandiacus',
      description: 'Large white owl adapted to Arctic climates.',
      image_url: 'https://example.com/owl.png',
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesBySlug).toHaveBeenCalledWith('snowy-owl');
    await screen.findByText('Snowy Owl');
    await screen.findByText('Large white owl adapted to Arctic climates.');
  });

  it('falls back to sample data when the fetch request fails', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockUseLocalSearchParams.mockReturnValue({ slug: 'desert-fern' });
    mockFetchSpeciesBySlug.mockRejectedValue(new Error('Network down'));

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesBySlug).toHaveBeenCalledWith('desert-fern');
    expect(mockSpeciesPage).toHaveBeenCalled();
    await screen.findByText(mountainBallCactusData.commonName);
    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to load species 'desert-fern':",
      'Network down',
    );

    consoleSpy.mockRestore();
  });

  it('logs the default failure message when the rejection is not an Error instance', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockUseLocalSearchParams.mockReturnValue({ slug: 'string-failure' });
    mockFetchSpeciesBySlug.mockRejectedValue('uh oh');

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to load species 'string-failure':",
      'Failed to load species',
    );
    consoleSpy.mockRestore();
  });

  it('falls back to sample data when the API returns null for a valid slug', async () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'ghost-orchid' });
    mockFetchSpeciesBySlug.mockResolvedValue(null as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesBySlug).toHaveBeenCalledWith('ghost-orchid');
    await screen.findByText(mountainBallCactusData.commonName);
  });

  it('prefers image_source strings returned by the API over image_url', async () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'seaside-daisy' });
    mockFetchSpeciesBySlug.mockResolvedValue({
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
    mockUseLocalSearchParams.mockReturnValue({ slug: 'forest-fern' });
    mockFetchSpeciesBySlug.mockResolvedValue({
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

  it('renders nothing while the slug data is still loading', () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'pending-lichen' });
    mockFetchSpeciesBySlug.mockReturnValue(new Promise(() => { }));

    const { toJSON } = render(<SpeciesBasicsPage />);

    expect(mockSpeciesPage).not.toHaveBeenCalled();
    expect(toJSON()).toBeNull();
  });

  it('falls back to the sample overview image when no image fields are provided', async () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'faceless-flora' });
    mockFetchSpeciesBySlug.mockResolvedValue({
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
    mockUseLocalSearchParams.mockReturnValue({ slug: 'lagging-fern' });
    let resolveFetch: (value: any) => void = () => { };
    const pendingFetch = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    mockFetchSpeciesBySlug.mockReturnValue(pendingFetch as any);

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
    mockUseLocalSearchParams.mockReturnValue({ slug: 'phantom-sedge' });
    let rejectFetch: (reason?: unknown) => void = () => { };
    const pendingFetch = new Promise((_, reject) => {
      rejectFetch = reject;
    });
    mockFetchSpeciesBySlug.mockReturnValue(pendingFetch as any);

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

  describe('__SPECIES_BASICS_TESTING__ helpers', () => {
    it('builds SpeciesPageData with payload overrides', () => {
      const payload = {
        common_name: 'Prairie Smoke',
        scientific_name: 'Geum triflorum',
        description: 'Feathery seed-heads add spring interest.',
        image_source: 'https://example.com/prairie-smoke.png',
      };

      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(payload, 'prairie-smoke');

      expect(result.id).toBe('prairie-smoke');
      expect(result.commonName).toBe('Prairie Smoke');
      expect(result.scientificName).toBe('Geum triflorum');
      expect(result.overview.description).toBe(payload.description);
      expect(result.overview.imageSource).toEqual({ uri: 'https://example.com/prairie-smoke.png' });
      expect(result.dataSections).toBe(mountainBallCactusData.dataSections);
    });

    it('falls back to the sample data when slug and payload fields are missing', () => {
      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData({}, undefined);

      expect(result.id).toBe(mountainBallCactusData.id);
      expect(result.commonName).toBe(mountainBallCactusData.commonName);
      expect(result.scientificName).toBe(mountainBallCactusData.scientificName);
      expect(result.overview.description).toBe(mountainBallCactusData.overview.description);
      expect(result.overview.imageSource).toBe(mountainBallCactusData.overview.imageSource);
    });
  });
});
