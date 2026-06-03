// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useColorScheme as useRNColorScheme } from 'react-native';
import { useOptionalSettings } from '@/context/SettingsContext';

const DEFAULT_COLOR_SCHEME = 'dark';

/**
 * Returns the current color scheme ('light' or 'dark').
 * Defaults to 'dark' if the system color scheme is null or undefined so the UI loads in dark mode.
 */
export function useColorScheme() {
  const settings = useOptionalSettings();
  const colorScheme = useRNColorScheme();

  if (settings?.colorModeOverride === 'light') {
    return 'light';
  }

  if (settings?.colorModeOverride === 'dark') {
    return 'dark';
  }

  return colorScheme ?? DEFAULT_COLOR_SCHEME;
}
