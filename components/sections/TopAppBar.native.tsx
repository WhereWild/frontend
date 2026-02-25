import { IconRotateCcw } from '@/assets/icons';
import { IconButton } from '@/components/buttons/IconButton';
import { Colors, Shadows, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import {
  LeadingContent,
  PrimaryAction,
} from './TopAppBarParts.native';
import type {
  LeadingContentProps,
  TopAppBarProps,
} from './TopAppBar.types';
import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export type { TopAppBarProps, TopAppBarVariant } from './TopAppBar.types';

const TOP_APP_BAR_HEIGHT = 64;
const TOP_APP_BAR_HORIZONTAL_PADDING = Size.space['200'];
const SAFE_AREA_INSETS_FALLBACK = { top: 0, bottom: 0, left: 0, right: 0 };
const NOOP = () => {};

export function TopAppBar({
  variant = 'home',
  title = 'Page Title',
  logoSource = require('@/assets/images/wherewild.png'),
  logoAccessibilityLabel = 'WhereWild logo',
  searchValue,
  onSearchValueChange,
  onSubmitSearch,
  searchPlaceholder,
  hasSecondaryButton = true,
  hasPrimaryButton = true,
  isPrimaryButtonIcon = false,
  secondaryButtonAccessibilityLabel = 'Refresh',
  primaryButtonAccessibilityLabel = 'Filter',
  primaryIconButtonAccessibilityLabel = 'Filter action',
  primaryButtonLabel = 'Filter',
  onPressBack,
  onPressSecondaryButton,
  onPressPrimaryButton,
  style,
}: TopAppBarProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? SAFE_AREA_INSETS_FALLBACK;
  const safeAreaTopInset = insets.top;

  const isPhoneBreakpoint = responsive.breakpoint === 'phone';
  const shouldRenderSpacer = variant !== 'search';
  const shouldRenderPrimaryAsIcon = isPrimaryButtonIcon || isPhoneBreakpoint;
  const isSecondaryActionEnabled = typeof onPressSecondaryButton === 'function';

  let leadingContentProps: LeadingContentProps;

  if (variant === 'search') {
    leadingContentProps = {
      variant,
      title,
      logoSource,
      logoAccessibilityLabel,
      searchValue: searchValue ?? '',
      onSearchValueChange: onSearchValueChange ?? NOOP,
      onSubmitSearch: onSubmitSearch ?? NOOP,
      searchPlaceholder,
    };
  } else if (variant === 'page') {
    leadingContentProps = {
      variant,
      title,
      logoSource,
      logoAccessibilityLabel,
      onPressBack: onPressBack ?? NOOP,
    };
  } else {
    leadingContentProps = {
      variant: 'home',
      title,
      logoSource,
      logoAccessibilityLabel,
    };
  }

  return (
    <View
      testID="top-app-bar-safe-area"
      style={[
        styles.safeAreaContainer,
        {
          backgroundColor: palette.background.default.secondary,
          paddingTop: safeAreaTopInset,
        },
        Shadows.dropShadow200.style,
        style,
      ]}
    >
      <View style={styles.container} accessibilityRole="header" testID="top-app-bar-container">
        <LeadingContent
          {...leadingContentProps}
        />
        {shouldRenderSpacer ? <View style={styles.spacer} /> : null}
        <View style={styles.actionsRow}>
          <View style={styles.fixedActionsRow} testID="top-app-bar-actions-fixed">
            {hasSecondaryButton ? (
              <IconButton
                variant="neutral"
                icon={<IconRotateCcw />}
                onPress={onPressSecondaryButton}
                disabled={!isSecondaryActionEnabled}
                accessibilityLabel={secondaryButtonAccessibilityLabel}
              />
            ) : null}
          </View>
          <PrimaryAction
            hasPrimaryButton={hasPrimaryButton}
            shouldRenderPrimaryAsIcon={shouldRenderPrimaryAsIcon}
            onPressPrimaryButton={onPressPrimaryButton}
            primaryIconButtonAccessibilityLabel={primaryIconButtonAccessibilityLabel}
            primaryButtonAccessibilityLabel={primaryButtonAccessibilityLabel}
            primaryButtonLabel={primaryButtonLabel}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: {
    width: '100%',
  },
  container: {
    width: '100%',
    height: TOP_APP_BAR_HEIGHT,
    paddingHorizontal: TOP_APP_BAR_HORIZONTAL_PADDING,
    paddingVertical: Size.space['200'],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  spacer: {
    flex: 1,
    minWidth: 0,
    minHeight: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
    flexShrink: 0,
  },
  fixedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
});
