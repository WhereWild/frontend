import React, { forwardRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getInteractiveCursorStyle } from '@/components/interactiveCursorStyle';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '@/components/text/ThemedText';

type PressableRef = React.ElementRef<typeof Pressable>;

type PillState = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

const TRANSPARENT = 'transparent';

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
  style?: StyleProp<ViewStyle>;
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
      borderColor: TRANSPARENT,
      textColor: palette.text.brand.onBrand,
    };
  }

  if (pressed) {
    return {
      backgroundColor: palette.background.neutral.tertiaryPressed,
      borderColor: TRANSPARENT,
      textColor: palette.text.neutral.onNeutralTertiary,
    };
  }

  if (hovered) {
    return {
      backgroundColor: palette.background.neutral.tertiaryHover,
      borderColor: TRANSPARENT,
      textColor: palette.text.neutral.onNeutralTertiary,
    };
  }

  return {
    backgroundColor: TRANSPARENT,
    borderColor: palette.border.neutral.tertiary,
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
    style,
  },
  ref
) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const pillState = getPillState(mode, isActive, isPressed, isHovered);

  return (
    <Pressable
      ref={ref}
      collapsable={false}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: isActive }}
      onFocus={onFocus}
      focusable={focusable}
      testID={testID}
      onPress={() => onPress(id)}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onLayout={(event) => {
        onContentLayout?.(event.nativeEvent.layout.width);
      }}
      style={[
        getInteractiveCursorStyle(),
        styles.pill,
        style,
        {
          backgroundColor: pillState.backgroundColor,
          borderColor: pillState.borderColor,
          width: contentWidth,
        },
      ]}
      // @ts-expect-error react-native-web supports onKeyDown for keyboard accessibility.
      onKeyDown={onKeyDown}
      tabIndex={tabIndex}
    >
      <View style={styles.innerContent} collapsable={false}>
        <View
          collapsable={false}
          style={[styles.iconSlot, !icon && styles.hiddenIconSlot]}
        >
          {icon}
        </View>
        <View collapsable={false} style={styles.labelSlot}>
          <ThemedText
            variant="singleLineBody"
            style={{ color: pillState.textColor }}
            numberOfLines={1}
          >
            {label}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
});


const styles = StyleSheet.create({
  pill: {
    borderRadius: Size.radius['full'],
    borderWidth: Size.stroke.border,
    paddingHorizontal: BASE_HORIZONTAL_PADDING,
    paddingVertical: BASE_VERTICAL_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  innerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconSlot: {
    marginRight: Size.space['100'],
  },
  hiddenIconSlot: {
    width: 0,
    marginRight: 0,
    overflow: 'hidden',
  },
  labelSlot: {
    flexShrink: 1,
  },
});
