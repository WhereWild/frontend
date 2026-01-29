import { Colors } from '@/constants/theme';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { PressableStateCallbackType, StyleSheet } from 'react-native';
import { SpeciesCard, __SPECIES_CARD_TESTING__ } from '../SpeciesCard';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import type { Router } from 'expo-router';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
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

describe('SpeciesCard', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
    pushMock = jest.fn();
    routerStub = createRouterStub({ push: pushMock as Router['push'] });
    mockUseRouter.mockReturnValue(routerStub);
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

  it('navigates using the provided identifiers when pressed', () => {
    render(<SpeciesCard {...baseProps} testID="species-card" />);

    fireEvent.press(screen.getByTestId('species-card'));

    expect(pushMock).toHaveBeenCalledWith('/species/555/binomial-nomenclature');
  });

  it('trims whitespace before slugifying the scientific name', () => {
    render(
      <SpeciesCard
        {...baseProps}
        scientificName="  Strix nebulosa  "
        testID="species-card"
      />,
    );

    fireEvent.press(screen.getByTestId('species-card'));

    expect(pushMock).toHaveBeenCalledWith('/species/555/strix-nebulosa');
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

    expect(pushMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('SpeciesCard requires a taxonId to navigate');
    consoleErrorSpy.mockRestore();
  });

  it('logs when the provided scientific name is missing', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <SpeciesCard
        {...baseProps}
        scientificName=""
        testID="species-card"
      />,
    );

    fireEvent.press(screen.getByTestId('species-card'));

    expect(pushMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('SpeciesCard requires a scientific name to navigate');
    consoleErrorSpy.mockRestore();
  });

  it('logs when the scientific name cannot be converted to a slug', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <SpeciesCard
        {...baseProps}
        scientificName={'!!!'}
        testID="species-card"
      />,
    );

    fireEvent.press(screen.getByTestId('species-card'));

    expect(pushMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'SpeciesCard: scientific name could not be converted to a valid URL segment',
    );
    consoleErrorSpy.mockRestore();
  });

  it('does not display a description when the compact size is used', () => {
    render(
      <SpeciesCard
        {...baseProps}
        size='compact'
        testID="species-card"
      />,
    );

    expect(screen.queryByTestId('species-card-description')).toBeNull();

    render(
      <SpeciesCard
        {...baseProps}
        testID="species-card"
      />,
    );
    
    expect(screen.getByTestId('species-card-description')).toBeTruthy();
    });
});
