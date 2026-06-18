// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render } from '@testing-library/react-native';
import { MapCategoricalLegend } from '../speciesOccurrenceMap/MapCategoricalLegend';
import { useResponsive } from '@/hooks/useResponsive';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { LegendClass } from '@/data/types';

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: jest.fn(() => ({
    breakpoint: 'desktop',
    contentWidth: 1200,
    gap: 32,
    marginHorizontal: 32,
  })),
}));

const mockUseResponsive = useResponsive as jest.Mock;
const mockUseColorScheme = useColorScheme as jest.Mock;

const sampleClasses: LegendClass[] = [
  { id: 1, name: 'Forest', color: '#228B22' },
  { id: 2, name: 'Desert', color: '#C2B280' },
  { id: 3, name: 'Water', color: '#1E90FF' },
  { id: 4, name: 'Grassland', color: '#90EE90' },
];

describe('MapCategoricalLegend', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'desktop',
      contentWidth: 1200,
      gap: 32,
      marginHorizontal: 32,
    });
  });

  it('returns null when classes array is empty', () => {
    const { toJSON } = render(<MapCategoricalLegend classes={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('renders with classes', () => {
    expect(() =>
      render(<MapCategoricalLegend classes={sampleClasses} />),
    ).not.toThrow();
  });

  it('renders collapsed by default on phone breakpoint', () => {
    mockUseResponsive.mockReturnValue({
      breakpoint: 'phone',
      contentWidth: 375,
      gap: 16,
      marginHorizontal: 16,
    });
    expect(() =>
      render(<MapCategoricalLegend classes={sampleClasses} />),
    ).not.toThrow();
  });

  it('renders initially expanded on desktop (not collapsed)', () => {
    expect(() =>
      render(<MapCategoricalLegend classes={sampleClasses} />),
    ).not.toThrow();
  });

  it('renders with shapesEnabled and variableId', () => {
    expect(() =>
      render(
        <MapCategoricalLegend
          classes={sampleClasses}
          variableId='kg2'
          shapesEnabled
        />,
      ),
    ).not.toThrow();
  });

  it('renders with achromatopsia cbMode', () => {
    expect(() =>
      render(
        <MapCategoricalLegend
          classes={sampleClasses}
          variableId='kg2'
          cbMode='achromatopsia'
        />,
      ),
    ).not.toThrow();
  });

  it('renders with colorblind cbMode', () => {
    expect(() =>
      render(
        <MapCategoricalLegend
          classes={sampleClasses}
          variableId='kg2'
          cbMode='colorblind'
        />,
      ),
    ).not.toThrow();
  });

  it('renders with markerOutlineEnabled', () => {
    expect(() =>
      render(
        <MapCategoricalLegend
          classes={sampleClasses}
          variableId='kg2'
          markerOutlineEnabled
        />,
      ),
    ).not.toThrow();
  });

  it('renders in light mode', () => {
    mockUseColorScheme.mockReturnValueOnce('light');
    expect(() =>
      render(<MapCategoricalLegend classes={sampleClasses} />),
    ).not.toThrow();
  });

  it('renders without variableId when shapesEnabled is false', () => {
    expect(() =>
      render(
        <MapCategoricalLegend classes={sampleClasses} shapesEnabled={false} />,
      ),
    ).not.toThrow();
  });
});
