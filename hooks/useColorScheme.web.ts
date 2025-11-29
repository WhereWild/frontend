import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

const DEFAULT_COLOR_SCHEME: 'light' | 'dark' = 'dark';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme ?? DEFAULT_COLOR_SCHEME;
  }

  return DEFAULT_COLOR_SCHEME;
}
