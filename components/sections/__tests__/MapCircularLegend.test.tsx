// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render } from '@testing-library/react-native';
import { MapCircularLegend } from '../speciesOccurrenceMap/MapCircularLegend';
import { donutArcPath } from '../speciesOccurrenceMap/variableColors';
import { useColorScheme } from '@/hooks/useColorScheme';

const mockUseColorScheme = useColorScheme as jest.Mock;

describe('MapCircularLegend', () => {
  it('renders with no props (all defaults)', () => {
    expect(() => render(<MapCircularLegend />)).not.toThrow();
  });

  it('renders with pinnedValue', () => {
    expect(() => render(<MapCircularLegend pinnedValue={180} />)).not.toThrow();
  });

  it('renders with null pinnedValue', () => {
    expect(() =>
      render(<MapCircularLegend pinnedValue={null} />),
    ).not.toThrow();
  });

  it('renders shapes mode', () => {
    expect(() => render(<MapCircularLegend shapesEnabled />)).not.toThrow();
  });

  it('renders shapes mode with nsweColors', () => {
    expect(() =>
      render(
        <MapCircularLegend
          shapesEnabled
          nsweColors={['#ff0000', '#00ff00', '#0000ff', '#ffff00']}
        />,
      ),
    ).not.toThrow();
  });

  it('renders with markerOutlineEnabled', () => {
    expect(() =>
      render(<MapCircularLegend markerOutlineEnabled />),
    ).not.toThrow();
  });

  it('renders with custom conicCss', () => {
    expect(() =>
      render(<MapCircularLegend conicCss='conic-gradient(red, blue)' />),
    ).not.toThrow();
  });

  it('renders with custom arcSegmentColors', () => {
    expect(() =>
      render(
        <MapCircularLegend
          arcSegmentColors={Array.from(
            { length: 72 },
            (_, i) => `hsl(${i * 5},70%,50%)`,
          )}
        />,
      ),
    ).not.toThrow();
  });

  it('renders in light mode', () => {
    mockUseColorScheme.mockReturnValueOnce('light');
    expect(() => render(<MapCircularLegend />)).not.toThrow();
  });
});

describe('donutArcPath', () => {
  it('uses large-arc flag for spans greater than 180 degrees', () => {
    const path = donutArcPath(28, 28, 28, 16, 0, 270);
    expect(path).toMatch(/,1,1,/);
  });

  it('does not use large-arc flag for spans of 180 degrees or less', () => {
    const path = donutArcPath(28, 28, 28, 16, 0, 90);
    expect(path).toMatch(/,0,1,/);
  });
});
