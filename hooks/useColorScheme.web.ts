// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useOptionalSettings } from '@/context/SettingsContext';

const DEFAULT_COLOR_SCHEME: 'light' | 'dark' = 'dark';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  const settings = useOptionalSettings();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (settings?.colorModeOverride === 'light') {
    return 'light';
  }

  if (settings?.colorModeOverride === 'dark') {
    return 'dark';
  }

  if (hasHydrated) {
    return colorScheme ?? DEFAULT_COLOR_SCHEME;
  }

  return DEFAULT_COLOR_SCHEME;
}
