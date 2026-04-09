import type { ViewStyle } from 'react-native';

export const getInteractiveCursorStyle = (disabled = false): ViewStyle => ({
  cursor: disabled ? 'auto' : 'pointer',
});
