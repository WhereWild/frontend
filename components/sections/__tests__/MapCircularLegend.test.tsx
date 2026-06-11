// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render } from '@testing-library/react-native';
import { MapCircularLegend } from '../speciesOccurrenceMap/MapCircularLegend';

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

  it('renders with custom nativeColor', () => {
    expect(() =>
      render(<MapCircularLegend nativeColor='rgb(255,0,0)' />),
    ).not.toThrow();
  });

  it('renders in light mode', () => {
    const { useColorScheme } = require('@/hooks/useColorScheme');
    (useColorScheme as jest.Mock).mockReturnValueOnce('light');
    expect(() => render(<MapCircularLegend />)).not.toThrow();
  });
});
