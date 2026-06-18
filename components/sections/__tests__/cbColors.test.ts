// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getCbColor, getCbShape } from '../speciesOccurrenceMap/cbColors';

describe('getCbColor', () => {
  it('returns fallback when cbMode is null', () => {
    expect(getCbColor('kg2', 1, null, '#aabbcc')).toBe('#aabbcc');
  });

  it('returns fallback when cbMode is undefined', () => {
    expect(getCbColor('kg2', 1, undefined, '#aabbcc')).toBe('#aabbcc');
  });

  it('returns cb color for known variable and class', () => {
    const result = getCbColor('kg2', 1, 'colorblind', '#fallback');
    expect(result).not.toBe('#fallback');
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('returns fallback for unknown variable id', () => {
    expect(getCbColor('unknown_var', 1, 'colorblind', '#fallback')).toBe(
      '#fallback',
    );
  });

  it('returns fallback for unknown class id', () => {
    expect(getCbColor('kg2', 9999, 'colorblind', '#fallback')).toBe(
      '#fallback',
    );
  });

  it('strips temporal suffix before lookup', () => {
    const withSuffix = getCbColor('kg2_avg_168h', 1, 'colorblind', '#fallback');
    const withoutSuffix = getCbColor('kg2', 1, 'colorblind', '#fallback');
    expect(withSuffix).toBe(withoutSuffix);
  });

  it('returns color for achromatopsia mode', () => {
    const result = getCbColor('kg2', 1, 'achromatopsia', '#fallback');
    expect(result).not.toBe('#fallback');
  });
});

describe('getCbShape', () => {
  it('returns a known shape for a variable and class id that exist', () => {
    const result = getCbShape('kg2', 1);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns circle as fallback for unknown variable', () => {
    expect(getCbShape('unknown_var', 1)).toBe('circle');
  });

  it('returns circle as fallback for unknown class id', () => {
    expect(getCbShape('kg2', 9999)).toBe('circle');
  });

  it('strips temporal suffix before lookup', () => {
    const withSuffix = getCbShape('kg2_mode_168h', 1);
    const withoutSuffix = getCbShape('kg2', 1);
    expect(withSuffix).toBe(withoutSuffix);
  });
});
