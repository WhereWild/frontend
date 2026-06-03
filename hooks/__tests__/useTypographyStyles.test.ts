// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook } from '@testing-library/react-native';
import { Colors, Typography, getTypographyForMode } from '@/constants/theme';
import { getResponsive } from '@/constants/responsive';
import { useTypographyStyles } from '../useTypographyStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';

jest.mock('@/hooks/useColorScheme');
jest.mock('@/hooks/useResponsive');

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;
const mockUseResponsive = useResponsive as jest.MockedFunction<typeof useResponsive>;

describe('useTypographyStyles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseResponsive.mockReturnValue(getResponsive());
  });

  it('returns typography tokens configured for the light palette', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useTypographyStyles());

    expect(result.current.heading.color).toBe(Colors.light.text.brand.secondary);
    expect(result.current.heading.fontSize).toBe(Typography.light.heading.fontSize);
  });

  it('uses the dark palette when scheme is dark', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useTypographyStyles());

    expect(result.current.heading.color).toBe(Colors.dark.text.brand.secondary);
    expect(result.current.heading.fontSize).toBe(Typography.dark.heading.fontSize);
  });

  it('falls back to light palette when color scheme is undefined', () => {
    mockUseColorScheme.mockReturnValue(undefined as unknown as 'light');

    const { result } = renderHook(() => useTypographyStyles());

    expect(result.current.heading.color).toBe(Colors.light.text.brand.secondary);
    expect(result.current.heading.fontSize).toBe(Typography.light.heading.fontSize);
  });

  it('recomputes styles when the color scheme changes', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result, rerender } = renderHook(() => useTypographyStyles());

    mockUseColorScheme.mockReturnValue('dark');
    rerender(undefined);

    expect(result.current.heading.color).toBe(Colors.dark.text.brand.secondary);
  });

  it('honors responsive root font size when provided', () => {
    mockUseColorScheme.mockReturnValue('light');
    mockUseResponsive.mockReturnValue({ ...getResponsive({ windowWidth: 1440 }), rootFontSize: 20 });

    const { result } = renderHook(() => useTypographyStyles());
    const expectedTokens = getTypographyForMode('light', 20);

    expect(result.current.body.fontSize).toBe(expectedTokens.body.fontSize);
    expect(result.current.body.lineHeight).toBe(expectedTokens.body.lineHeight);
  });

  it('falls back to default root font size when responsive is missing it', () => {
    mockUseColorScheme.mockReturnValue('light');
    mockUseResponsive.mockReturnValue({ ...getResponsive({ windowWidth: 1024 }), rootFontSize: undefined as any });

    const { result } = renderHook(() => useTypographyStyles());
    const expectedTokens = getTypographyForMode('light', 16);

    expect(result.current.body.fontSize).toBe(expectedTokens.body.fontSize);
    expect(result.current.body.lineHeight).toBe(expectedTokens.body.lineHeight);
  });

  it('exposes every Typography token key in the style map', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useTypographyStyles());

    expect(Object.keys(result.current).sort()).toEqual(Object.keys(Typography.light).sort());
  });
});
