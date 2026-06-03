// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { render } from '@testing-library/react-native';
import { HomeRecommendationFilter } from '../HomeRecommendationFilter';

type MockNavigationPillListProps = {
  pills: { key: string; label: string }[];
  selectedKey: string;
};

const mockNavigationPillList = jest.fn(
  (_props: MockNavigationPillListProps) => null,
);

jest.mock('../../navigation/NavigationPillList', () => ({
  NavigationPillList: (props: MockNavigationPillListProps) => {
    mockNavigationPillList(props);
    return null;
  },
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('HomeRecommendationFilter', () => {
  beforeEach(() => {
    mockNavigationPillList.mockClear();
  });

  const getLatestPillListProps = () => {
    const pillListProps = mockNavigationPillList.mock.calls.at(-1)?.[0];

    expect(pillListProps).toBeDefined();

    return pillListProps;
  };

  it('renders backend groups that are not part of the fixed label map', () => {
    render(
      <HomeRecommendationFilter
        allRecommendations={[
          {
            taxonId: 1,
            commonName: 'Mystery Species',
            commonNames: ['Mystery Species'],
            scientificName: 'Mysterius species',
            description: '',
            taxonGroup: 'mollusks',
          },
          {
            taxonId: 2,
            commonName: 'Plant Species',
            commonNames: ['Plant Species'],
            scientificName: 'Plantus species',
            description: '',
            taxonGroup: 'plants',
          },
        ]}
        activeGroup='mollusks'
        onGroupChange={jest.fn()}
      />,
    );

    const pillListProps = getLatestPillListProps();
    expect(pillListProps?.selectedKey).toBe('mollusks');
    expect(pillListProps?.pills).toEqual([
      { key: 'all', label: 'All' },
      { key: 'plants', label: 'Plants' },
      { key: 'mollusks', label: 'Mollusks' },
    ]);
  });

  it('formats unknown groups split by spaces, underscores, and hyphens', () => {
    render(
      <HomeRecommendationFilter
        allRecommendations={[
          {
            taxonId: 1,
            commonName: 'Mystery Species',
            commonNames: ['Mystery Species'],
            scientificName: 'Mysterius species',
            description: '',
            taxonGroup: 'deep__sea-mammals',
          },
        ]}
        activeGroup='deep__sea-mammals'
        onGroupChange={jest.fn()}
      />,
    );

    const pillListProps = getLatestPillListProps();

    expect(pillListProps?.pills).toEqual([
      { key: 'all', label: 'All' },
      { key: 'deep__sea-mammals', label: 'Deep Sea Mammals' },
    ]);
  });

  it('preserves non-empty mixed-case unknown group segments', () => {
    render(
      <HomeRecommendationFilter
        allRecommendations={[
          {
            taxonId: 1,
            commonName: 'Mystery Species',
            commonNames: ['Mystery Species'],
            scientificName: 'Mysterius species',
            description: '',
            taxonGroup: 'mIxEd_CASE-group',
          },
        ]}
        activeGroup='mIxEd_CASE-group'
        onGroupChange={jest.fn()}
      />,
    );

    const pillListProps = getLatestPillListProps();

    expect(pillListProps?.pills).toEqual([
      { key: 'all', label: 'All' },
      { key: 'mIxEd_CASE-group', label: 'MIxEd CASE Group' },
    ]);
  });

  it('ignores nullish groups and de-duplicates repeated unknown groups', () => {
    render(
      <HomeRecommendationFilter
        allRecommendations={[
          {
            taxonId: 1,
            commonName: 'Unknown A',
            commonNames: ['Unknown A'],
            scientificName: 'Unknowna species',
            description: '',
            taxonGroup: 'mollusks',
          },
          {
            taxonId: 2,
            commonName: 'Unknown B',
            commonNames: ['Unknown B'],
            scientificName: 'Unknownb species',
            description: '',
            taxonGroup: 'mollusks',
          },
          {
            taxonId: 3,
            commonName: 'No Group',
            commonNames: ['No Group'],
            scientificName: 'Nogroup species',
            description: '',
            taxonGroup: null,
          },
          {
            taxonId: 4,
            commonName: 'Known Group',
            commonNames: ['Known Group'],
            scientificName: 'Known species',
            description: '',
            taxonGroup: 'plants',
          },
        ]}
        activeGroup='mollusks'
        onGroupChange={jest.fn()}
      />,
    );

    const pillListProps = getLatestPillListProps();

    expect(pillListProps?.pills).toEqual([
      { key: 'all', label: 'All' },
      { key: 'plants', label: 'Plants' },
      { key: 'mollusks', label: 'Mollusks' },
    ]);
  });
});
