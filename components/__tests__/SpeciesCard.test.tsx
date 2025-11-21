import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SpeciesCard } from '../SpeciesCard';

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
});
