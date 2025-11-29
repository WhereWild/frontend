import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Returns the current color scheme ('light' or 'dark').
 * Defaults to 'dark' if the system color scheme is null or undefined so the UI loads in dark mode.
 */
export function useColorScheme() {
  const colorScheme = useRNColorScheme();
  return colorScheme ?? 'dark';
}
