import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { ThemedText } from '@/components/text/ThemedText';

export type TabState = {
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
  containerStyle?: StyleProp<ViewStyle>;
  separatorColor?: string;
  separatorHidden?: boolean;
  disableNativeHoverVisuals?: boolean;
  onKeyDown?: (event: { nativeEvent?: { key?: string }; preventDefault?: () => void }) => void;
  onFocus?: () => void;
  onLabelLayout?: (width: number) => void;
  focusable?: boolean;
  tabIndex?: 0 | -1;
  accessibilityLabel?: string;
  testID?: string;
};

export type NativeTabProps = Omit<TabProps, 'onKeyDown' | 'focusable' | 'tabIndex'>;

export const getTabState = (
  mode: 'light' | 'dark',
  isActive: boolean,
  pressed: boolean,
  hovered: boolean,
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

type TabContentProps = {
  label: string;
  tabState: TabState;
  onLabelLayout?: (width: number) => void;
  pillStyle?: StyleProp<ViewStyle>;
  separatorColor?: string;
  separatorHidden?: boolean;
};

export function TabContent({
  label,
  tabState,
  onLabelLayout,
  pillStyle,
  separatorColor,
  separatorHidden = false,
}: TabContentProps) {
  return (
    <View style={styles.tabContentWrapper} collapsable={false}>
      <View
        style={[
          styles.pill,
          { backgroundColor: tabState.pillBackgroundColor },
          pillStyle,
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
      {separatorColor ? (
        <View
          style={[
            styles.separator,
            { pointerEvents: 'none' },
            { backgroundColor: separatorColor },
            separatorHidden ? styles.separatorHidden : undefined,
          ]}
        />
      ) : null}
      {onLabelLayout && (
        <View
          style={[styles.measurer, { pointerEvents: 'none' }]}
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
    </View>
  );
}

export const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderTopLeftRadius: Size.radius['200'],
    borderTopRightRadius: Size.radius['200'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContentWrapper: {
    width: '100%',
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
    left: -9999,
    top: 0,
  },
  separator: {
    position: 'absolute',
    // Native tabs render separators inside the padded tab container, so shift
    // them back to the actual outer edge of the tab.
    right: -Size.space['200'],
    top: '50%',
    transform: [{ translateY: -Size.space['200'] }],
    width: Size.stroke.border,
    height: Size.space['400'],
  },
  separatorHidden: {
    opacity: 0,
  },
});

export const __TAB_TESTING__ = {
  getTabState,
};