// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import SpeciesBasicsPage, {
  __SPECIES_BASICS_TESTING__,
} from '../[...identifier]';
import { mountainBallCactusData } from '@/data/speciesSample';
import { useLocalSearchParams, useRouter, usePathname } from 'expo-router';
import { fetchSpeciesByTaxonId, fetchSpeciesObscured } from '@/data/api';

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
  fetchSpeciesObscured: jest
    .fn()
    .mockResolvedValue({ taxon_id: '0', all_obscured: false }),
}));

jest.mock('@/context/SettingsContext', () => ({
  useSettings: () => ({ units: 'metric' }),
}));

jest.mock('../../_species', () => {
  const ReactNative = jest.requireActual('react-native');
  const { Text, View } = ReactNative;

  return {
    __esModule: true,
    default: ({ data }: { data: typeof mountainBallCactusData }) => (
      <View>
        <Text>{data.commonName}</Text>
        <Text>{data.scientificName}</Text>
        <Text>{data.overview.description}</Text>
        <Text>{data.allObscured ? 'all-obscured' : 'not-obscured'}</Text>
      </View>
    ),
  };
});

const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<
  typeof useLocalSearchParams
>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;
const mockFetchSpeciesByTaxonId = fetchSpeciesByTaxonId as jest.MockedFunction<
  typeof fetchSpeciesByTaxonId
>;
const mockFetchSpeciesObscured = fetchSpeciesObscured as jest.MockedFunction<
  typeof fetchSpeciesObscured
>;

const flushMicrotasksQueue = () =>
  new Promise((resolve) => setImmediate(resolve));

const createRouterMock = () =>
  ({
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
  }) as unknown as ReturnType<typeof useRouter>;

const SAMPLE_TAXON_ID = '123456';

describe('SpeciesBasicsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReturnValue(createRouterMock());
    mockUsePathname.mockReturnValue('/');
    mockFetchSpeciesObscured.mockResolvedValue({
      taxon_id: '0',
      all_obscured: false,
    });
  });

  it('renders a not-found screen when no identifier parameter is supplied', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(jest.fn());
    mockUseLocalSearchParams.mockReturnValue({});

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalled();
    expect(screen.getByTestId('species-page-not-found')).toBeTruthy();
    expect(screen.getByText('No species id was provided.')).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it('fetches species basics and maps the response onto SpeciesPage props', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Snowy Owl',
      common_names: ['Snowy Owl', 'Arctic Owl'],
      scientific_name: 'Bubo scandiacus',
      description: 'Large white owl adapted to Arctic climates.',
      image_url: 'https://example.com/owl.png',
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(SAMPLE_TAXON_ID, {
      units: 'metric',
    });
    expect(mockFetchSpeciesObscured).toHaveBeenCalledWith(SAMPLE_TAXON_ID);
    await waitFor(() => {
      expect(screen.getAllByText('Snowy Owl').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Bubo scandiacus')).toBeTruthy();
    await screen.findByText('Large white owl adapted to Arctic climates.');
    expect(screen.getByText('not-obscured')).toBeTruthy();
  });

  it('renders obscured status from the obscured lookup', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Snowy Owl',
      scientific_name: 'Bubo scandiacus',
      description: 'Large white owl adapted to Arctic climates.',
    } as any);
    mockFetchSpeciesObscured.mockResolvedValue({
      taxon_id: SAMPLE_TAXON_ID,
      all_obscured: true,
    });

    render(<SpeciesBasicsPage />);

    await waitFor(() => {
      expect(screen.getByText('all-obscured')).toBeTruthy();
    });
  });

  it('clears a prior obscured state when the identifier changes and the next obscured lookup fails', async () => {
    const firstIdentifier = '111';
    const secondIdentifier = '222';
    mockUseLocalSearchParams.mockReturnValue({ identifier: firstIdentifier });
    mockFetchSpeciesByTaxonId.mockImplementation(
      async (taxonId) =>
        ({
          common_name: `Species ${taxonId}`,
          scientific_name: `Species scientific ${taxonId}`,
          description: `Description ${taxonId}`,
        }) as any,
    );
    mockFetchSpeciesObscured
      .mockResolvedValueOnce({
        taxon_id: firstIdentifier,
        all_obscured: true,
      })
      .mockRejectedValueOnce(new Error('Obscured lookup failed'));

    const { rerender } = render(<SpeciesBasicsPage />);

    await waitFor(() => {
      expect(screen.getByText('all-obscured')).toBeTruthy();
    });

    mockUseLocalSearchParams.mockReturnValue({ identifier: secondIdentifier });
    rerender(<SpeciesBasicsPage />);

    await waitFor(() => {
      expect(screen.getByText(`Species ${secondIdentifier}`)).toBeTruthy();
    });
    expect(screen.getByText('not-obscured')).toBeTruthy();
    expect(mockFetchSpeciesObscured).toHaveBeenNthCalledWith(
      1,
      firstIdentifier,
    );
    expect(mockFetchSpeciesObscured).toHaveBeenNthCalledWith(
      2,
      secondIdentifier,
    );
  });

  it('renders a not-found screen when the fetch request fails', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockRejectedValue(new Error('Network down'));

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(SAMPLE_TAXON_ID, {
      units: 'metric',
    });
    await waitFor(() => {
      expect(screen.getByTestId('species-page-not-found')).toBeTruthy();
    });
    expect(
      screen.getByText(
        `We couldn't find a species with id "${SAMPLE_TAXON_ID}".`,
      ),
    ).toBeTruthy();
    expect(consoleSpy).toHaveBeenCalledWith(
      `Failed to load species '${SAMPLE_TAXON_ID}':`,
      'Network down',
    );

    consoleSpy.mockRestore();
  });

  it('logs the default failure message when the rejection is not an Error instance', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
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

  it('renders a not-found screen when the API returns null for a valid identifier', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue(null as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(SAMPLE_TAXON_ID, {
      units: 'metric',
    });
    await waitFor(() => {
      expect(screen.getByTestId('species-page-not-found')).toBeTruthy();
    });
    expect(
      screen.getByText(
        `We couldn't find a species with id "${SAMPLE_TAXON_ID}".`,
      ),
    ).toBeTruthy();
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

    const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
      (await mockFetchSpeciesByTaxonId(SAMPLE_TAXON_ID)) as any,
      SAMPLE_TAXON_ID,
    );

    expect(result.overview.imageSource).toEqual({
      uri: 'https://example.com/preferred.png',
    });
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

    const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
      (await mockFetchSpeciesByTaxonId(SAMPLE_TAXON_ID)) as any,
      SAMPLE_TAXON_ID,
    );

    expect(result.overview.imageSource).toBe(providedSource);
  });

  it('builds a live heatmap tile url when backend heatmap metadata is present', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Heatmap Test',
      scientific_name: 'Heatmap testus',
      description: 'Species with a live model artifact.',
      heatmap: {
        available: true,
        resolved_model_id: 'taxon_123456_gbt_20260313T065439Z',
      },
    } as any);

    const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
      (await mockFetchSpeciesByTaxonId(SAMPLE_TAXON_ID)) as any,
      SAMPLE_TAXON_ID,
    );

    expect(result.heatmap.liveAvailable).toBe(true);
    expect(result.heatmap.liveTileUrl).toContain(
      '/api/species/123456/heatmap/tiles/{z}/{x}/{y}.png?model_id=taxon_123456_gbt_20260313T065439Z',
    );
  });

  it('defaults heatmap model id and forwards phenology/full availability flags', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Heatmap Defaults',
      scientific_name: 'Heatmap defaults',
      description: 'Species with backend availability flags.',
      heatmap: {
        available: true,
        resolved_model_id: '   ',
        phenology_available: true,
        full_available: true,
      },
    } as any);

    const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
      (await mockFetchSpeciesByTaxonId(SAMPLE_TAXON_ID)) as any,
      SAMPLE_TAXON_ID,
    );

    expect(result.heatmap.liveModelId).toBe('auto_gbt');
    expect(result.heatmap.liveTileUrl).toContain('model_id=auto_gbt');
    expect(result.heatmap.phenologyAvailable).toBe(true);
    expect(result.heatmap.fullAvailable).toBe(true);
  });

  it('renders the loading shell while the identifier data is still loading', () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockReturnValue(new Promise(() => {}));

    render(<SpeciesBasicsPage />);

    expect(screen.getByTestId('species-page-loading')).toBeTruthy();
    expect(screen.getByLabelText('Loading species data')).toBeTruthy();
    expect(screen.getByText('Loading species...')).toBeTruthy();
  });

  it('falls back to the sample overview image when no image fields are provided', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Faceless Flora',
      scientific_name: 'Nulla imago',
      description: 'Species reported without image metadata.',
    } as any);

    const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
      (await mockFetchSpeciesByTaxonId(SAMPLE_TAXON_ID)) as any,
      SAMPLE_TAXON_ID,
    );

    expect(result.overview.imageSource).toBe(
      mountainBallCactusData.overview.imageSource,
    );
  });

  it('ignores late success responses after unmounting', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    let resolveFetch: (value: any) => void = () => {};
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
  });

  it('ignores late error responses after unmounting', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    let rejectFetch: (reason?: unknown) => void = () => {};
    const pendingFetch = new Promise((_, reject) => {
      rejectFetch = reject;
    });
    mockFetchSpeciesByTaxonId.mockReturnValue(pendingFetch as any);

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const { unmount } = render(<SpeciesBasicsPage />);
    unmount();

    await act(async () => {
      rejectFetch(new Error('Delayed failure'));
      await flushMicrotasksQueue();
    });

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('ignores late obscured lookup failures after unmounting', async () => {
    mockUseLocalSearchParams.mockReturnValue({ identifier: SAMPLE_TAXON_ID });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Snowy Owl',
      scientific_name: 'Bubo scandiacus',
      description: 'Large white owl adapted to Arctic climates.',
    } as any);
    let rejectObscured: (reason?: unknown) => void = () => {};
    const pendingObscured = new Promise((_, reject) => {
      rejectObscured = reject;
    });
    mockFetchSpeciesObscured.mockReturnValue(pendingObscured as any);

    const { unmount } = render(<SpeciesBasicsPage />);
    unmount();

    await act(async () => {
      rejectObscured(new Error('Delayed obscured failure'));
      await flushMicrotasksQueue();
    });
  });

  it('prioritizes taxon id identifiers when provided via path segments', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      identifier: ['1234', 'strix-nebulosa'],
    });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Great Gray Owl',
      scientific_name: 'Strix nebulosa',
      description: 'Large gray owl.',
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith('1234', {
      units: 'metric',
    });
  });

  it('logs an error and renders a not-found screen when the identifier is invalid', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockUseLocalSearchParams.mockReturnValue({
      identifier: 'invalid identifier',
    });

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Missing taxon ID in route segments.',
    );
    expect(screen.getByTestId('species-page-not-found')).toBeTruthy();

    consoleSpy.mockRestore();
  });

  it('accepts alphanumeric (non-numeric) taxon IDs from path segments', async () => {
    mockUseLocalSearchParams.mockReturnValue({
      identifier: ['6SRLS', 'opuntia-fragilis'],
    });
    mockFetchSpeciesByTaxonId.mockResolvedValue({
      common_name: 'Brittle Prickly-pear',
      scientific_name: 'Opuntia fragilis',
      description: 'A cold-hardy prickly pear.',
    } as any);

    render(<SpeciesBasicsPage />);
    await act(async () => {
      await flushMicrotasksQueue();
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith('6SRLS', {
      units: 'metric',
    });
    expect(mockFetchSpeciesObscured).toHaveBeenCalledWith('6SRLS');
  });

  describe('__SPECIES_BASICS_TESTING__ helpers', () => {
    it('builds SpeciesPageData with payload overrides', () => {
      const payload = {
        taxon_id: '24680',
        common_name: 'Prairie Smoke',
        common_names: ['Prairie Smoke', "Old Man's Whiskers"],
        scientific_name: 'Geum triflorum',
        description: 'Feathery seed-heads add spring interest.',
        description_sections: [
          {
            id: 'summary',
            title: 'Summary',
            lines: [{ body: 'Feathery seed-heads add spring interest.' }],
          },
        ],
        image_source: 'https://example.com/prairie-smoke.png',
      } as any;

      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
        payload,
        '13579',
      );
      expect(result.taxonId).toBe('24680');
      expect(result.commonName).toBe('Prairie Smoke');
      expect(result.commonNames).toEqual([
        'Prairie Smoke',
        "Old Man's Whiskers",
      ]);
      expect(result.scientificName).toBe('Geum triflorum');
      expect(result.overview.description).toBe(payload.description);
      expect(result.overview.sections).toEqual(payload.description_sections);
      expect(result.overview.imageSource).toEqual({
        uri: 'https://example.com/prairie-smoke.png',
      });
    });

    it('uses first common_names entry when common_name is missing', () => {
      const payload = {
        taxon_id: '24680',
        common_names: ['Northern Wolf', 'Gray Wolf'],
        scientific_name: 'Canis lupus',
      } as any;

      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
        payload,
        '13579',
      );
      expect(result.commonName).toBe('Northern Wolf');
      expect(result.commonNames).toEqual(['Northern Wolf', 'Gray Wolf']);
    });

    it('trims common_name before assigning resolved commonName', () => {
      const payload = {
        taxon_id: '24680',
        common_name: '  Cougar  ',
        common_names: ['Mountain Lion'],
        scientific_name: 'Puma concolor',
      } as any;

      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
        payload,
        '13579',
      );
      expect(result.commonName).toBe('Cougar');
      expect(result.commonNames).toEqual(['Cougar', 'Mountain Lion']);
    });

    it('filters and trims dirty common_names values before fallback selection', () => {
      const payload = {
        taxon_id: '24680',
        common_name: '   ',
        common_names: [null, '  Wolf  ', '', '   ', 'Gray Wolf'],
        scientific_name: 'Canis lupus',
      } as any;

      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
        payload,
        '13579',
      );
      expect(result.commonName).toBe('Wolf');
      expect(result.commonNames).toEqual(['Wolf', 'Gray Wolf']);
    });

    it('uses the requested taxon id when payload lacks taxon data', () => {
      const fallbackTaxonId = '97531';
      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData(
        {},
        fallbackTaxonId,
      );
      expect(result.taxonId).toBe(fallbackTaxonId);
      expect(result.commonName).toBe(mountainBallCactusData.commonName);
      expect(result.scientificName).toBe(mountainBallCactusData.scientificName);
    });

    it('uses sample fallback taxon id when neither payload nor request includes one', () => {
      const result = __SPECIES_BASICS_TESTING__.buildSpeciesPageData({});
      expect(result.taxonId).toBe(mountainBallCactusData.taxonId);
    });

    it('derives identifier priorities from route params', () => {
      const params = {
        identifier: ['9876', 'encoded-sci'],
        taxonId: '1111',
      };

      const { fetchIdentifier, requestedTaxonId } =
        __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBe('9876');
      expect(requestedTaxonId).toBe('9876');
    });

    it('returns undefined when taxon identifiers are unavailable', () => {
      const params = {
        identifier: ['Invalid ID'],
      };

      const { fetchIdentifier, requestedTaxonId } =
        __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBeUndefined();
      expect(requestedTaxonId).toBeUndefined();
    });

    it('ignores empty identifier segments altogether', () => {
      const params = {
        identifier: ['', '   '],
      };

      const { fetchIdentifier, requestedTaxonId } =
        __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBeUndefined();
      expect(requestedTaxonId).toBeUndefined();
    });

    it('trims whitespace before validating alphanumeric identifier segments', () => {
      const params = {
        identifier: ['   654321   ', 'trailing-slug'],
      };

      const { fetchIdentifier, requestedTaxonId } =
        __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBe('654321');
      expect(requestedTaxonId).toBe('654321');
    });

    it('accepts alphanumeric taxon ID segments that are not purely numeric', () => {
      const params = {
        identifier: ['6SRLS', 'opuntia-fragilis'],
      };

      const { fetchIdentifier, requestedTaxonId } =
        __SPECIES_BASICS_TESTING__.getIdentifierFromParams(params);

      expect(fetchIdentifier).toBe('6SRLS');
      expect(requestedTaxonId).toBe('6SRLS');
    });
  });
});
