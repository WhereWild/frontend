import { Colors } from '@/constants/theme';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { PressableStateCallbackType, StyleSheet } from 'react-native';
import { SpeciesCard, __SPECIES_CARD_TESTING__ } from '../cards/SpeciesCard';
import { useColorScheme } from '@/hooks/useColorScheme';
import { fetchSpeciesBySlug } from '@/data/api';
import { useRouter } from 'expo-router';
import type { Router } from 'expo-router';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('@/data/api', () => ({
  fetchSpeciesBySlug: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockFetchSpeciesBySlug = fetchSpeciesBySlug as jest.MockedFunction<typeof fetchSpeciesBySlug>;
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

type FetchSpeciesResponse = Awaited<ReturnType<typeof fetchSpeciesBySlug>>;
const buildFetchResponse = (overrides: Partial<FetchSpeciesResponse> = {}): FetchSpeciesResponse => ({
  taxon_id: null,
  slug: null,
  scientific_name: '',
  common_name: '',
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
    mockFetchSpeciesBySlug.mockReset();
  });

  const baseProps = {
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
    mockFetchSpeciesBySlug.mockResolvedValue(
      buildFetchResponse({
        common_name: 'Snowy Owl',
        description: 'Large white owl adapted to Arctic climates.',
        image_source: 'https://example.com/owl.png',
      }),
    );

    render(<SpeciesCard {...baseProps} testID="species-card" />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('species-card'));
    });

    expect(mockFetchSpeciesBySlug).toHaveBeenCalledWith(baseProps.commonName);
    expect(pushMock).toHaveBeenCalledWith('/species/Snowy%20Owl');
  });

  it('does nothing when commonName is falsy', async () => {
    render(<SpeciesCard {...baseProps} commonName="" testID="species-card" />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('species-card'));
    });

    expect(mockFetchSpeciesBySlug).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does not navigate when the fetched species common name resolves to null', async () => {
    mockFetchSpeciesBySlug.mockResolvedValue(
      buildFetchResponse({
        common_name: null as unknown as string,
      }),
    );

    render(<SpeciesCard {...baseProps} testID="species-card" />);

    await act(async () => {
      fireEvent.press(screen.getByTestId('species-card'));
    });

    expect(mockFetchSpeciesBySlug).toHaveBeenCalledWith(baseProps.commonName);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does not navigate when fetchSpeciesBySlug rejects', async () => {
    const rejection = new Error('network unavailable');
    mockFetchSpeciesBySlug.mockRejectedValueOnce(rejection);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    render(<SpeciesCard {...baseProps} testID="species-card" />);

    try {
      await act(async () => {
        fireEvent.press(screen.getByTestId('species-card'));
      });

      expect(mockFetchSpeciesBySlug).toHaveBeenCalledWith(baseProps.commonName);
      expect(pushMock).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch species data for',
        baseProps.commonName,
        rejection,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
