// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook } from '@testing-library/react-native';
import type { EnvironmentVariableOption } from '@/components/sections/speciesEnvironment/model';
import type { ColormapId } from '../variableColors';
import {
  isVariableOrdinal,
  resolveClassDisplayColor,
  resolveColorMode,
  useOrdinalFallbackColor,
} from '../ordinalColorMode';

const ordinalMeta = (
  overrides: Partial<EnvironmentVariableOption> = {},
): EnvironmentVariableOption => ({
  id: 'salinity_two',
  label: 'salinity_two',
  valueType: 'ordinal',
  renderMin: 0,
  renderMax: 4,
  ...overrides,
});

describe('isVariableOrdinal', () => {
  it('is true for an ordinal variable, case-insensitively', () => {
    expect(isVariableOrdinal(ordinalMeta({ valueType: 'Ordinal' }))).toBe(true);
  });

  it('is false for nominal/continuous/null', () => {
    expect(isVariableOrdinal(ordinalMeta({ valueType: 'nominal' }))).toBe(
      false,
    );
    expect(isVariableOrdinal(ordinalMeta({ valueType: 'ratio' }))).toBe(false);
    expect(isVariableOrdinal(null)).toBe(false);
    expect(isVariableOrdinal(undefined)).toBe(false);
  });
});

describe('resolveColorMode', () => {
  it('uses the selected colormap for ordinal, ignoring cbMode', () => {
    expect(resolveColorMode(true, 'magma', 'achromatopsia')).toBe('magma');
    expect(resolveColorMode(true, 'magma', undefined)).toBe('magma');
  });

  it('uses cbMode for non-ordinal', () => {
    expect(resolveColorMode(false, 'magma', 'achromatopsia')).toBe(
      'achromatopsia',
    );
    expect(resolveColorMode(false, 'magma', undefined)).toBeUndefined();
  });
});

describe('useOrdinalFallbackColor', () => {
  it('returns the given fallback unchanged for a non-ordinal variable', () => {
    const { result } = renderHook(() =>
      useOrdinalFallbackColor(false, ordinalMeta(), 'magma'),
    );
    expect(result.current(2, '#888888')).toBe('#888888');
  });

  it('returns the fallback when renderMin/renderMax are missing', () => {
    const { result } = renderHook(() =>
      useOrdinalFallbackColor(
        true,
        ordinalMeta({ renderMin: null, renderMax: null }),
        'magma',
      ),
    );
    expect(result.current(2, '#888888')).toBe('#888888');
  });

  it('returns the fallback when renderMin equals renderMax (zero-width range)', () => {
    const { result } = renderHook(() =>
      useOrdinalFallbackColor(
        true,
        ordinalMeta({ renderMin: 2, renderMax: 2 }),
        'magma',
      ),
    );
    expect(result.current(2, '#888888')).toBe('#888888');
  });

  it('samples the selected colormap live at the class position, not the frozen fallback', () => {
    const { result } = renderHook(() =>
      useOrdinalFallbackColor(true, ordinalMeta(), 'magma'),
    );
    // magma's own first/last stops (see variableColors.ts's MAGMA_STOPS),
    // not whatever frozen legend color was passed as fallback.
    expect(result.current(0, '#440154').toLowerCase()).toBe('#000004');
    expect(result.current(4, '#fde725').toLowerCase()).toBe('#fcfdbf');
  });

  it('re-samples when the selected colormap changes', () => {
    const { result, rerender } = renderHook(
      ({ colormap }: { colormap: ColormapId }) =>
        useOrdinalFallbackColor(true, ordinalMeta(), colormap),
      { initialProps: { colormap: 'viridis' } },
    );
    const viridisColor = result.current(0, '#000000');
    rerender({ colormap: 'magma' });
    const magmaColor = result.current(0, '#000000');
    expect(magmaColor).not.toBe(viridisColor);
  });
});

describe('resolveClassDisplayColor', () => {
  const identityFallback = (classId: number, fallback: string) => fallback;

  it('returns the ordinal fallback directly when colorMode is falsy', () => {
    const result = resolveClassDisplayColor(
      'salinity_two',
      2,
      null,
      '#440154',
      identityFallback,
    );
    expect(result).toBe('#440154');
  });

  it('treats a missing raw color as the shared #888888 default before falling back', () => {
    const capture = jest.fn((classId: number, fallback: string) => fallback);
    resolveClassDisplayColor('salinity_two', 2, null, null, capture);
    expect(capture).toHaveBeenCalledWith(2, '#888888');
  });

  it('falls through getCbColor to the ordinal fallback for a variable with no CB_CLASS_COLORS entry', () => {
    const result = resolveClassDisplayColor(
      'salinity_two', // not a real catalog id -- no CB_CLASS_COLORS entry
      0,
      'magma',
      '#440154',
      () => '#000004', // what the live-colormap fallback would produce
    );
    expect(result).toBe('#000004');
  });

  it('prefers a real CB_CLASS_COLORS entry over the ordinal fallback when one exists', () => {
    const result = resolveClassDisplayColor(
      'salinity', // a real catalog variable with precomputed CB_CLASS_COLORS
      0,
      'viridis',
      '#440154',
      identityFallback,
    );
    // The precomputed table wins -- see cbColors.ts's salinity.viridis[0].
    expect(result).toBe('#440154');
  });
});
