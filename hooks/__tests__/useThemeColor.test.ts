// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook } from '@testing-library/react-native';
import { Colors } from '@/constants/theme';
import { useThemeColor } from '../useThemeColor';
import { useColorScheme } from '@/hooks/useColorScheme';

jest.mock('@/hooks/useColorScheme');

const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

describe('useThemeColor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers an explicit light override when provided', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() =>
      useThemeColor({ light: '#ffffff' }, 'background'),
    );

    expect(result.current).toBe('#ffffff');
  });

  it('falls back to palette colors when override missing', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useThemeColor({}, 'text'));

    expect(result.current).toBe(Colors.dark.text);
  });

  it('respects dark override value', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() =>
      useThemeColor({ dark: '#111111' }, 'border'),
    );

    expect(result.current).toBe('#111111');
  });

  it('defaults to light palette when color scheme hook is undefined', () => {
    mockUseColorScheme.mockReturnValue(undefined as unknown as 'light');

    const { result } = renderHook(() => useThemeColor({}, 'background'));

    expect(result.current).toBe(Colors.light.background);
  });
});
