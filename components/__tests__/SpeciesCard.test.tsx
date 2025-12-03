import { Colors } from '@/constants/theme';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { PressableStateCallbackType, StyleSheet } from 'react-native';
import { SpeciesCard, __SPECIES_CARD_TESTING__ } from '../cards/SpeciesCard';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fetchSpeciesByTaxonId } from '@/data/api';
import { useRouter } from 'expo-router';
import type { Router } from 'expo-router';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/data/api', () => ({
  fetchSpeciesByTaxonId: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockFetchSpeciesByTaxonId = fetchSpeciesByTaxonId as jest.MockedFunction<typeof fetchSpeciesByTaxonId>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

let pushMock: jest.Mock;
let routerStub: Router;

const createRouterStub = (overrides: Partial<Router> = {}): Router => ({
  back: jest.fn() as Router['back'],
  canGoBack: jest.fn(() => false) as Router['canGoBack'],
  push: jest.fn() as Router['push'],
  navigate: jest.fn() as Router['navigate'],
  replace: jest.fn() as Router['replace'],
  dismiss: jest.fn() as Router['dismiss'],
  dismissAll: jest.fn() as Router['dismissAll'],
  dismissTo: jest.fn() as Router['dismissTo'],
  canDismiss: jest.fn(() => false) as Router['canDismiss'],
  setParams: jest.fn() as Router['setParams'],
  reload: jest.fn() as Router['reload'],
  prefetch: jest.fn() as Router['prefetch'],
  ...overrides,
});

type HoverAwarePressableState = PressableStateCallbackType & { hovered?: boolean };
const createPressableState = (
  state: Partial<HoverAwarePressableState> = {},
): HoverAwarePressableState => ({
  pressed: state.pressed ?? false,
  hovered: state.hovered ?? false,
});

type FetchSpeciesResponse = Awaited<ReturnType<typeof fetchSpeciesByTaxonId>>;
const buildFetchResponse = (overrides: Partial<FetchSpeciesResponse> = {}): FetchSpeciesResponse => ({
  taxon_id: 4242,
  scientific_name: 'Resolved Scientific',
  common_name: 'Resolved Common',
  image_source: null,
  _raw: {},
  description: 'description pending',
  ...overrides,
});

describe('SpeciesCard', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
    pushMock = jest.fn();
    routerStub = createRouterStub({ push: pushMock as Router['push'] });
    mockUseRouter.mockReturnValue(routerStub);
    mockFetchSpeciesByTaxonId.mockReset();
  });

  const baseProps = {
    taxonId: 555,
    commonName: 'Common Name',
    scientificName: 'Binomial nomenclature',
    description: 'Description',
  };

  it('renders placeholder when no image is provided', () => {
    render(<SpeciesCard {...baseProps} />);

    expect(screen.getByTestId('species-card-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('species-card-image')).toBeNull();
  });

  it('renders provided image source', () => {
    render(
      <SpeciesCard
        {...baseProps}
        imageSource={{ uri: 'https://example.com/species.png' }}
      />,
    );

    expect(screen.getByTestId('species-card-image')).toBeTruthy();
    expect(screen.queryByTestId('species-card-placeholder')).toBeNull();
  });

  it('fires the onPress callback when tapped', () => {
    const handlePress = jest.fn();
    render(<SpeciesCard {...baseProps} onPress={handlePress} testID="species-card" />);

    fireEvent.press(screen.getByTestId('species-card'));

    expect(handlePress).toHaveBeenCalledTimes(1);
  });

  it('maps hover and pressed states to the secondary palette by default', () => {
    const palette = Colors.light;
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(palette, createPressableState({
        pressed: true,
      })),
    ).toBe(palette.background.default.secondaryPressed);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(palette, createPressableState({
        hovered: true,
      })),
    ).toBe(palette.background.default.secondaryHover);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(palette, createPressableState({})),
    ).toBe(palette.background.default.secondary);
  });

  it('can render the tertiary palette via variant', () => {
    const palette = Colors.light;
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        createPressableState({ pressed: true }),
        'tertiary',
      ),
    ).toBe(palette.background.default.tertiaryPressed);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        createPressableState({ hovered: true }),
        'tertiary',
      ),
    ).toBe(palette.background.default.tertiaryHover);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        createPressableState({}),
        'tertiary',
      ),
    ).toBe(palette.background.default.tertiary);
  });

  it('applies light mode neutral placeholder background when scheme is light', () => {
    mockUseColorScheme.mockReturnValue('light');

    render(<SpeciesCard {...baseProps} />);

    const placeholder = screen.getByTestId('species-card-placeholder');
    const placeholderStyles = StyleSheet.flatten(placeholder.props.style);
    expect(placeholderStyles.backgroundColor).toBe(
      Colors.light.background.neutral.default,
    );
  });

  it('fetches species data and navigates when no onPress is supplied', async () => {
    mockFetchSpeciesByTaxonId.mockResolvedValue(
      buildFetchResponse({
        taxon_id: 777,
        scientific_name: 'Strix nebulosa',
        description: 'Large gray owl.',
      }),
    );

    render(<SpeciesCard {...baseProps} testID="species-card" />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('species-card'));
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(String(baseProps.taxonId));
    expect(pushMock).toHaveBeenCalledWith('/species/777/strix-nebulosa');
  });

  it('does nothing when no identifier is available', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    render(
      <SpeciesCard
        {...baseProps}
        taxonId={undefined as unknown as number}
        commonName=""
        scientificName=""
        testID="species-card"
      />,
    );

    expect(screen.getByTestId('species-card')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('species-card'));
    });

    expect(mockFetchSpeciesByTaxonId).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('SpeciesCard requires a taxonId to navigate');
    consoleErrorSpy.mockRestore();
  });

  it('does not navigate when the resolved identifiers are missing', async () => {
    mockFetchSpeciesByTaxonId.mockResolvedValue(
      buildFetchResponse({
        taxon_id: null,
        scientific_name: null,
      }),
    );

    render(
      <SpeciesCard
        {...baseProps}
        commonName=""
        scientificName=""
        testID="species-card"
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('species-card'));
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(String(baseProps.taxonId));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does not navigate when fetchSpeciesByTaxonId rejects', async () => {
    const rejection = new Error('network unavailable');
    mockFetchSpeciesByTaxonId.mockRejectedValueOnce(rejection);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    render(<SpeciesCard {...baseProps} testID="species-card" />);

    try {
      await act(async () => {
        fireEvent.press(screen.getByTestId('species-card'));
      });

      expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(String(baseProps.taxonId));
      expect(pushMock).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch species data for',
        String(baseProps.taxonId),
        rejection,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('falls back to provided identifiers when the backend omits them', async () => {
    mockFetchSpeciesByTaxonId.mockResolvedValue(
      buildFetchResponse({
        taxon_id: null,
        scientific_name: null,
      }),
    );

    render(
      <SpeciesCard
        {...baseProps}
        taxonId={9001}
        scientificName="Card Provided Scientific"
        testID="species-card"
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('species-card'));
    });

    expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith('9001');
    expect(pushMock).toHaveBeenCalledWith('/species/9001/card-provided-scientific');
  });

  it('logs failures with the taxon identifier when provided', async () => {
    const rejection = new Error('network timeout');
    mockFetchSpeciesByTaxonId.mockRejectedValueOnce(rejection);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    render(<SpeciesCard {...baseProps} testID="species-card" />);

    try {
      await act(async () => {
        fireEvent.press(screen.getByTestId('species-card'));
      });

      expect(mockFetchSpeciesByTaxonId).toHaveBeenCalledWith(String(baseProps.taxonId));
      expect(pushMock).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch species data for',
        String(baseProps.taxonId),
        rejection,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
