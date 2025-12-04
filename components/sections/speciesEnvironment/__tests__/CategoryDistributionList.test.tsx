import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CategoryDistributionList } from '../CategoryDistributionList';
import type { SpeciesEnvironmentCategory } from '@/data/types';

const baseCategories: SpeciesEnvironmentCategory[] = [
  {
    value: 1,
    className: 'Forest',
    count: 30,
    fraction: 0.6,
    description: 'Dense canopy',
  },
  {
    value: 2,
    className: 'Grassland',
    count: 20,
    fraction: 0.4,
  },
];

const palette = {
  barColor: '#74a45b',
  trackColor: '#c8c8c8',
  descriptionColor: '#222222',
  observationPanelColor: '#ededed',
  observationChipColor: '#bbbbbb',
  hintColor: '#666666',
};

describe('CategoryDistributionList', () => {
  it('shows a fallback when no categories are available', () => {
    render(
      <CategoryDistributionList
        categories={[]}
        barColor={palette.barColor}
        trackColor={palette.trackColor}
        descriptionColor={palette.descriptionColor}
        observationPanelColor={palette.observationPanelColor}
        observationChipColor={palette.observationChipColor}
        hintColor={palette.hintColor}
        selectedValue={null}
      />,
    );

    expect(screen.getByText('Landcover categories unavailable.')).toBeTruthy();
  });

  it('renders interactive entries with observation panels', () => {
    const onSelect = jest.fn();
    const onObservationPress = jest.fn();
    const resolveSamples = (value: number) => (value === 1 ? [101, 202] : []);

    render(
      <CategoryDistributionList
        categories={baseCategories}
        barColor={palette.barColor}
        trackColor={palette.trackColor}
        descriptionColor={palette.descriptionColor}
        observationPanelColor={palette.observationPanelColor}
        observationChipColor={palette.observationChipColor}
        hintColor={palette.hintColor}
        selectedValue={1}
        onSelect={onSelect}
        resolveSamples={resolveSamples}
        onObservationPress={onObservationPress}
      />,
    );

    const toggle = screen.getByTestId('category-toggle-1');
    fireEvent.press(toggle);
    expect(onSelect).toHaveBeenCalledWith(1);

    expect(screen.getByText('Observations in Forest')).toBeTruthy();
    fireEvent.press(screen.getByText('#101'));
    expect(onObservationPress).toHaveBeenCalledWith(101);
    expect(screen.getByText('Tap again to hide observation IDs.')).toBeTruthy();
  });

  it('renders static rows for categories without samples and suppresses toggles', () => {
    const resolveSamples = () => null;

    render(
      <CategoryDistributionList
        categories={baseCategories}
        barColor={palette.barColor}
        trackColor={palette.trackColor}
        descriptionColor={palette.descriptionColor}
        observationPanelColor={palette.observationPanelColor}
        observationChipColor={palette.observationChipColor}
        hintColor={palette.hintColor}
        selectedValue={null}
        resolveSamples={resolveSamples}
      />,
    );

    expect(screen.queryByTestId('category-toggle-2')).toBeNull();
    expect(screen.getByText('Grassland')).toBeTruthy();
  });

  it('treats empty sample arrays as non-interactive rows', () => {
    const resolveSamples = () => [];

    render(
      <CategoryDistributionList
        categories={baseCategories}
        barColor={palette.barColor}
        trackColor={palette.trackColor}
        descriptionColor={palette.descriptionColor}
        observationPanelColor={palette.observationPanelColor}
        observationChipColor={palette.observationChipColor}
        hintColor={palette.hintColor}
        selectedValue={null}
        resolveSamples={resolveSamples}
      />,
    );

    expect(screen.queryByTestId('category-toggle-1')).toBeNull();
    expect(screen.queryByText(/Observations in/)).toBeNull();
  });
});
