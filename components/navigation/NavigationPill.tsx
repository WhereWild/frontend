import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/text/ThemedText';

type PressableRef = React.ElementRef<typeof Pressable>;

type PillState = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
};

type PillLayout = {
  paddingHorizontal: number;
  paddingVertical: number;
};

const BASE_HORIZONTAL_PADDING = Size.space['250'];
const BASE_VERTICAL_PADDING = Size.space['150'];

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
  icon?: React.ReactNode;
};

const getPillLayout = (borderWidth: number): PillLayout => ({
  paddingHorizontal: Math.max(0, BASE_HORIZONTAL_PADDING - borderWidth),
  paddingVertical: Math.max(0, BASE_VERTICAL_PADDING - borderWidth),
});

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
    icon,
  },
  ref
) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';

  return (
    <Pressable
      ref={ref}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: isActive }}
      onFocus={onFocus}
      focusable={focusable}
      testID={testID}
      onPress={() => onPress(id)}
      style={styles.pill}
      // @ts-expect-error react-native-web supports onKeyDown for keyboard accessibility.
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
    >
      {({ pressed, hovered }) => {
        const pillState = getPillState(mode, isActive, pressed, hovered ?? false);
        const layout = getPillLayout(pillState.borderWidth);
        return (
          <View
            style={[
              styles.pillContent,
              {
                backgroundColor: pillState.backgroundColor,
                borderColor: pillState.borderColor,
                borderWidth: pillState.borderWidth,
                paddingHorizontal: layout.paddingHorizontal,
                paddingVertical: layout.paddingVertical,
                width: contentWidth,
              },
            ]}
            onLayout={(event) => {
              onContentLayout?.(event.nativeEvent.layout.width);
            }}
          >
            <View style={styles.pillInner}>
              {icon && <View>{icon}</View>}
              <ThemedText
                variant="singleLineBody"
                style={{ color: pillState.textColor }}
                numberOfLines={1}
              >
                {label}
              </ThemedText>
            </View>
          </View>
        );
      }}
    </Pressable>
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
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['100'],
  },
});
