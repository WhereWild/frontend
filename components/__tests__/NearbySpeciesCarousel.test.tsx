// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { NearbySpeciesCarousel } from '../NearbySpeciesCarousel';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'dark'),
}));

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

const SAMPLE_SPECIES = [
  {
    taxonId: '185699',
    commonName: 'Utah Juniper',
    commonNames: ['Utah Juniper'],
    scientificName: 'Juniperus osteosperma',
    description:
      'Evergreen shrub or small tree adapted to high desert plateaus.',
  },
  {
    taxonId: '185700',
    commonName: 'Sagebrush',
    commonNames: ['Sagebrush'],
    scientificName: 'Artemisia tridentata',
    description:
      'Shrub with aromatic foliage often co-occurring with alpine cacti.',
  },
];

describe('NearbySpeciesCarousel', () => {
  beforeEach(() => {
    mockUseColorScheme.mockReturnValue('dark');
  });

  it('renders section heading and provided species cards', () => {
    render(<NearbySpeciesCarousel species={SAMPLE_SPECIES} />);

    expect(screen.getByText('Nearby Species')).toBeTruthy();
    expect(screen.getByText('Utah Juniper')).toBeTruthy();
    expect(screen.getByText('Juniperus osteosperma')).toBeTruthy();
    expect(screen.getByText('Sagebrush')).toBeTruthy();
  });

  it('returns null when species list is empty', () => {
    const { toJSON } = render(<NearbySpeciesCarousel species={[]} />);

    expect(toJSON()).toBeNull();
  });

  it('applies light mode background color when overridden to be light', () => {
    mockUseColorScheme.mockReturnValue('light');

    const tree = render(
      <NearbySpeciesCarousel species={SAMPLE_SPECIES} />,
    ).toJSON();

    if (!tree || Array.isArray(tree)) {
      throw new Error('Expected NearbySpeciesCarousel to render a root view');
    }

    const styles = StyleSheet.flatten(tree.props.style);
    expect(styles.backgroundColor).toBe(
      Colors.light.background.default.secondary,
    );
  });
});
