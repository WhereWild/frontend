import { Colors } from '@/constants/theme';
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { SpeciesCard, __SPECIES_CARD_TESTING__ } from '../cards/SpeciesCard';
import { useColorScheme } from '@/hooks/useColorScheme';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('SpeciesCard', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
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
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(palette, {
        pressed: true,
        hovered: false,
      } as any),
    ).toBe(palette.background.default.secondaryPressed);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(palette, {
        pressed: false,
        hovered: true,
      } as any),
    ).toBe(palette.background.default.secondaryHover);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(palette, {
        pressed: false,
        hovered: false,
      } as any),
    ).toBe(palette.background.default.secondary);
  });

  it('can render the tertiary palette via variant', () => {
    const palette = Colors.light;
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        { pressed: true, hovered: false } as any,
        'tertiary',
      ),
    ).toBe(palette.background.default.tertiaryPressed);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        { pressed: false, hovered: true } as any,
        'tertiary',
      ),
    ).toBe(palette.background.default.tertiaryHover);
    expect(
      __SPECIES_CARD_TESTING__.resolveSpeciesCardBackground(
        palette,
        { pressed: false, hovered: false } as any,
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
});
