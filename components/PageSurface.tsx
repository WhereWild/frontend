import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

type PageSurfaceProps = Pick<ViewProps, 'children' | 'testID'> & {
  style?: StyleProp<ViewStyle>;
};

export function PageSurface({ children, style, testID }: PageSurfaceProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <View
      testID={testID}
      style={[
        Platform.OS === 'web' ? styles.web : styles.native,
        { backgroundColor: palette.background.default.default },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  native: {
    flex: 1,
  },
  web: {
    width: '100%',
    minHeight: '100%',
  },
});
