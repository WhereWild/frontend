import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { ActiveNearYouSection } from '../ActiveNearYouSection';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('../../cards/SpeciesCard', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');

  return {
    SpeciesCard: ({ commonName }: { commonName: string }) => (
      <Text>{commonName}</Text>
    ),
  };
});

jest.mock('../../navigation/NavigationPillList', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');

  return {
    NavigationPillList: ({
      pills,
      selectedKey,
      onSelectionChange,
    }: {
      pills: { key: string; label: string }[];
      selectedKey: string;
      onSelectionChange?: (key: string) => void;
    }) => (
      <View>
        <Text testID='selected-pill'>{selectedKey}</Text>
        {pills.map((pill) => (
          <Pressable
            key={pill.key}
            testID={`pill-${pill.key}`}
            onPress={() => onSelectionChange?.(pill.key)}
          >
            <Text>{pill.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});

const recommendations = [
  {
    taxonId: 1,
    commonName: 'Plant One',
    commonNames: ['Plant One'],
    scientificName: 'Plantus one',
    description: 'Warm slopes',
    taxonGroup: 'plants',
  },
  {
    taxonId: 2,
    commonName: 'Bird Two',
    commonNames: ['Bird Two'],
    scientificName: 'Birdus two',
    description: 'Open scrub',
    taxonGroup: 'birds',
  },
  {
    taxonId: 3,
    commonName: 'Fungus Three',
    commonNames: ['Fungus Three'],
    scientificName: 'Fungus three',
    description: 'Moist shade',
    taxonGroup: 'fungi',
  },
];

describe('ActiveNearYouSection', () => {
  it('filters the displayed species by the selected group', () => {
    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
      />,
    );

    expect(screen.getByText('Active Near You')).toBeTruthy();
    expect(screen.getByText('Plant One')).toBeTruthy();
    expect(screen.getByText('Bird Two')).toBeTruthy();
    expect(screen.getByText('Fungus Three')).toBeTruthy();

    fireEvent.press(screen.getByTestId('pill-plants'));

    expect(screen.getByTestId('selected-pill').props.children).toBe('plants');
    expect(screen.getByText('Plant One')).toBeTruthy();
    expect(screen.queryByText('Bird Two')).toBeNull();
    expect(screen.queryByText('Fungus Three')).toBeNull();
  });

  it('only renders groups that are present in all recommendations', () => {
    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations.filter(
          (item) => item.taxonGroup !== 'birds',
        )}
      />,
    );

    expect(screen.getByTestId('pill-all')).toBeTruthy();
    expect(screen.getByTestId('pill-plants')).toBeTruthy();
    expect(screen.getByTestId('pill-fungi')).toBeTruthy();
    expect(screen.queryByTestId('pill-birds')).toBeNull();
  });

  it('resets an invalid externally controlled group back to all', async () => {
    const handleGroupChange = jest.fn();

    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations.filter(
          (item) => item.taxonGroup !== 'plants',
        )}
        activeGroup='plants'
        onGroupChange={handleGroupChange}
      />,
    );

    await waitFor(() => {
      expect(handleGroupChange).toHaveBeenCalledWith('all');
    });
  });

  it('hides the heading when showHeading is false', () => {
    render(
      <ActiveNearYouSection
        recommendations={recommendations}
        allRecommendations={recommendations}
        showHeading={false}
      />,
    );

    expect(screen.queryByText('Active Near You')).toBeNull();
  });
});
