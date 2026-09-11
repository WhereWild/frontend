// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import { defaultClassColor, defaultOrdinalColor } from '../paletteColors';

const HEX_RE = /^#[0-9a-f]{6}$/i;

describe('defaultClassColor', () => {
  it('returns a valid hex color', () => {
    expect(defaultClassColor(0, 5)).toMatch(HEX_RE);
  });

  it('gives distinct colors across a class set', () => {
    const colors = new Set(
      Array.from({ length: 6 }, (_, i) => defaultClassColor(i, 6)),
    );
    expect(colors.size).toBe(6);
  });

  it('handles a single class without dividing by zero', () => {
    expect(defaultClassColor(0, 0)).toMatch(HEX_RE);
  });
});

describe('defaultOrdinalColor', () => {
  it('returns a valid hex color', () => {
    expect(defaultOrdinalColor(0, 5)).toMatch(HEX_RE);
  });

  it('gives the same color for the first and last rank when there is one class', () => {
    expect(defaultOrdinalColor(0, 1)).toMatch(HEX_RE);
  });

  it('gives distinct colors for different ranks', () => {
    expect(defaultOrdinalColor(0, 5)).not.toBe(defaultOrdinalColor(4, 5));
  });
});
