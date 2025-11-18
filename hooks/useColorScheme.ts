import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Returns the current color scheme ('light' or 'dark').
 * Defaults to 'light' if the system color scheme is null or undefined.
 */
export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  return colorScheme ?? 'light';
}
