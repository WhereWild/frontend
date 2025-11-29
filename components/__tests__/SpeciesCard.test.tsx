import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SpeciesCard, __SPECIES_CARD_TESTING__ } from '../SpeciesCard';
import { Colors } from '@/constants/theme';

describe('SpeciesCard', () => {
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

  it('maps hover and pressed states to semantic tokens', () => {
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
});
