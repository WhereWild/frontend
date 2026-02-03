import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/text/ThemedText';

type PressableRef = React.ElementRef<typeof Pressable>;
type PressableWithKeyDownProps = PressableProps & {
  onKeyDown?: (event: { nativeEvent?: { key?: string }; preventDefault?: () => void }) => void;
  tabIndex?: 0 | -1;
};

const PressableWithKeyDown = forwardRef<PressableRef, PressableWithKeyDownProps>(function PressableWithKeyDown(
  { onKeyDown, tabIndex, ...props },
  ref
) {
  return (
    <Pressable
      ref={ref}
      {...props}
      // @ts-expect-error react-native-web supports onKeyDown and tabIndex for keyboard accessibility.
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
    />
  );
});

type PillState = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
};

export type NavigationPillProps = {
  id: string;
  label: string;
  isActive: boolean;
  onPress: (id: string) => void;
  onKeyDown?: (event: { nativeEvent?: { key?: string }; preventDefault?: () => void }) => void;
  onFocus?: () => void;
  onContentLayout?: (width: number) => void;
  contentWidth?: number;
  focusable?: boolean;
  tabIndex?: 0 | -1;
  accessibilityLabel?: string;
  testID?: string;
};

const getPillState = (
  mode: 'light' | 'dark',
  isActive: boolean,
  pressed: boolean,
  hovered: boolean
): PillState => {
  const palette = Colors[mode];

  if (isActive) {
    return {
      backgroundColor: palette.background.brand.default,
      borderColor: 'transparent',
      borderWidth: 0,
      textColor: palette.text.brand.onBrand,
    };
  }

  if (pressed) {
    return {
      backgroundColor: palette.background.neutral.tertiaryPressed,
      borderColor: 'transparent',
      borderWidth: 0,
      textColor: palette.text.neutral.onNeutralTertiary,
    };
  }

  if (hovered) {
    return {
      backgroundColor: palette.background.neutral.tertiaryHover,
      borderColor: 'transparent',
      borderWidth: 0,
      textColor: palette.text.neutral.onNeutralTertiary,
    };
  }

  return {
    backgroundColor: 'transparent',
    borderColor: palette.border.neutral.tertiary,
    borderWidth: Size.stroke.border,
    textColor: palette.text.neutral.tertiary,
  };
};

export const NavigationPill = forwardRef<PressableRef, NavigationPillProps>(function NavigationPill(
  {
    id,
    label,
    isActive,
    onPress,
    onKeyDown,
    onFocus,
    onContentLayout,
    contentWidth,
    focusable,
    tabIndex,
    accessibilityLabel,
    testID,
  },
  ref
) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <PressableWithKeyDown
      ref={ref}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: isActive }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      focusable={focusable}
      tabIndex={tabIndex}
      testID={testID}
      onPress={() => {
        if (!isActive) {
          onPress(id);
        }
      }}
      style={styles.pill}
    >
      {({ pressed, hovered }) => {
        const pillState = getPillState(mode, isActive, pressed, hovered ?? false);
        const borderWidth = pillState.borderWidth;
        // Adjust padding by borderWidth so that content + padding + border maintain a consistent
        // overall pill size across states with different border widths (e.g., active vs. default).
        const paddingHorizontal = Math.max(0, Size.space['250'] - borderWidth);
        const paddingVertical = Math.max(0, Size.space['150'] - borderWidth);
        return (
          <View
            style={[
              styles.pillContent,
              {
                backgroundColor: pillState.backgroundColor,
                borderColor: pillState.borderColor,
                borderWidth,
                paddingHorizontal,
                paddingVertical,
                width: contentWidth,
              },
            ]}
            onLayout={(event) => {
              onContentLayout?.(event.nativeEvent.layout.width);
            }}
          >
            <ThemedText
              variant="singleLineBody"
              style={{ color: pillState.textColor }}
              numberOfLines={1}
            >
              {label}
            </ThemedText>
          </View>
        );
      }}
    </PressableWithKeyDown>
  );
});


const styles = StyleSheet.create({
  pill: {
    borderRadius: Size.radius['full'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContent: {
    borderRadius: Size.radius['full'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
