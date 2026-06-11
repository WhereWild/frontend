// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { render } from '@testing-library/react-native';
import { ShapeMarker } from '../speciesOccurrenceMap/ShapeMarker';
import type { ShapeKey } from '../speciesOccurrenceMap/cbColors';

const SHAPES: ShapeKey[] = [
  'circle',
  'square',
  'triangle',
  'triangle-down',
  'diamond',
  'ring',
  'cross',
  'plus',
  'star',
  'hexagon',
  'pentagon',
  'arrow',
];

describe('ShapeMarker', () => {
  it.each(SHAPES)('renders shape %s without outline', (shape) => {
    expect(() =>
      render(<ShapeMarker shape={shape} color='#ff0000' />),
    ).not.toThrow();
  });

  it('renders ring with outline (uses two-circle variant)', () => {
    expect(() =>
      render(<ShapeMarker shape='ring' color='#ff0000' outline />),
    ).not.toThrow();
  });

  it('renders non-ring shape with outline', () => {
    expect(() =>
      render(<ShapeMarker shape='circle' color='#ff0000' outline />),
    ).not.toThrow();
  });

  it('applies custom size', () => {
    expect(() =>
      render(<ShapeMarker shape='circle' color='#00ff00' size={16} />),
    ).not.toThrow();
  });
});
