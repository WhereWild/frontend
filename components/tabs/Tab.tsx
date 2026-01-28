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

const PressableWithKeyDown = Pressable as unknown as React.ForwardRefExoticComponent<
  PressableWithKeyDownProps & React.RefAttributes<View>
>;

type TabState = {
  outerBackgroundColor: string;
  pillBackgroundColor: string;
  borderColor: string;
  textVariant: 'singleLineBody';
  textColor: string;
  borderBottomWidth: number;
};

export type TabProps = {
  id: string;
  label: string;
  isActive: boolean;
  onPress: (id: string) => void;
  onKeyDown?: (event: { nativeEvent?: { key?: string }; preventDefault?: () => void }) => void;
  onFocus?: () => void;
  /** Called with the natural (unconstrained) width of the label text. */
  onLabelLayout?: (width: number) => void;
  focusable?: boolean;
  tabIndex?: 0 | -1;
  accessibilityLabel?: string;
  testID?: string;
};

const getTabState = (
  mode: 'light' | 'dark',
  isActive: boolean,
  pressed: boolean,
  hovered: boolean
): TabState => {
  const palette = Colors[mode];
  const borderColor = palette.border.neutral.default;
  const outerBackgroundColor = isActive ? palette.background.neutral.default : 'transparent';
  const pillBackgroundColor = !isActive
    ? (pressed
      ? palette.background.neutral.pressed
      : hovered
        ? palette.background.neutral.hover
        : 'transparent')
    : 'transparent';
  const textColor = isActive || pressed || hovered
    ? palette.text.neutral.onNeutral
    : palette.text.neutral.default;
  const borderBottomWidth = Size.stroke.border;

  return {
    outerBackgroundColor,
    pillBackgroundColor,
    borderColor,
    textVariant: 'singleLineBody',
    textColor,
    borderBottomWidth,
  };
};

export const Tab = forwardRef<PressableRef, TabProps>(function Tab(
  {
    id,
    label,
    isActive,
    onPress,
    onKeyDown,
    onFocus,
    onLabelLayout,
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
      accessibilityRole="tab"
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
      style={({ pressed, hovered }) => {
        const tabState = getTabState(mode, isActive, pressed, hovered ?? false);
        return [
          styles.container,
          {
            backgroundColor: tabState.outerBackgroundColor,
            borderColor: tabState.borderColor,
            borderBottomWidth: tabState.borderBottomWidth,
          },
        ];
      }}
    >
      {({ pressed, hovered }) => {
        const tabState = getTabState(mode, isActive, pressed, hovered ?? false);
        return (
          <>
            <View
              style={[
                styles.pill,
                { backgroundColor: tabState.pillBackgroundColor },
              ]}
            >
              <ThemedText
                variant={tabState.textVariant}
                style={{ color: tabState.textColor }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {label}
              </ThemedText>
            </View>
            {/* Invisible measurer: renders unconstrained text to capture natural width */}
            {onLabelLayout && (
              <View
                style={styles.measurer}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <ThemedText
                  variant="singleLineBody"
                  onLayout={(event) => {
                    onLabelLayout(event.nativeEvent.layout.width);
                  }}
                >
                  {label}
                </ThemedText>
              </View>
            )}
          </>
        );
      }}
    </PressableWithKeyDown>
  );
});

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: Size.radius['200'],
    borderTopRightRadius: Size.radius['200'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingVertical: Size.space['100'],
    paddingHorizontal: Size.space['150'],
    borderRadius: Size.radius['200'],
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  measurer: {
    position: 'absolute',
    opacity: 0,
    // Prevent layout influence by placing off-screen
    left: -9999,
    top: 0,
  },
});

export const __TAB_TESTING__ = {
  getTabState,
};
