import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '../text/ThemedText';

export type TabProps = {
  id: string;
  label: string;
  isActive?: boolean;
  onPress?: (id: string) => void;
  onKeyDown?: (event: { nativeEvent?: { key?: string }; preventDefault?: () => void }) => void;
  onFocus?: () => void;
  focusable?: boolean;
  tabIndex?: number;
  onLabelLayout?: (width: number) => void;
  accessibilityLabel?: string;
  testID?: string;
};

export const Tab = React.forwardRef<Pressable, TabProps>(
  (
    {
      id,
      label,
      isActive = false,
      onPress,
      onKeyDown,
      onFocus,
      focusable,
      tabIndex,
      onLabelLayout,
      accessibilityLabel,
      testID,
    },
    ref,
  ) => {
    const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
    const palette = Colors[mode];
    const borderColor = isActive ? palette.border.default.default : 'transparent';
    const backgroundColor = isActive
      ? palette.background.default.secondary
      : 'transparent';
    const textColor = isActive
      ? palette.text.default.default
      : palette.text.default.secondary;

    return (
      <Pressable
        ref={ref}
        onPress={() => onPress?.(id)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        focusable={focusable}
        tabIndex={tabIndex}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID}
        style={[
          styles.tab,
          {
            backgroundColor,
            borderColor,
          },
        ]}
      >
        <View
          onLayout={(event) => {
            onLabelLayout?.(event.nativeEvent.layout.width);
          }}
        >
          <ThemedText
            variant="bodySmall"
            style={{ color: textColor }}
          >
            {label}
          </ThemedText>
        </View>
      </Pressable>
    );
  },
);

Tab.displayName = 'Tab';

const styles = StyleSheet.create({
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Size.space['150'],
    paddingHorizontal: Size.space['200'],
    borderRadius: Size.radius['200'],
    borderWidth: Size.stroke.border,
  },
});
