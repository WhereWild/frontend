import { IconFilter, IconRotateCcw } from '@/assets/icons';
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
import { useRouter } from 'expo-router';
import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export type { TopAppBarProps, TopAppBarVariant } from './TopAppBar.types';

const TOP_APP_BAR_HEIGHT = 64;
const SAFE_AREA_INSETS_FALLBACK = { top: 0, bottom: 0, left: 0, right: 0 };
const DEFAULT_SECONDARY_ACTION_ICON = <IconRotateCcw />;
const DEFAULT_PRIMARY_ACTION_ICON = <IconFilter />;
const DEFAULT_HOME_LOGO = require('@/assets/images/wherewild.png');
const DEFAULT_HOME_LOGO_ACCESSIBILITY_LABEL = 'Go to home';

export function TopAppBar(props: TopAppBarProps) {
  const router = useRouter();
  const {
    secondaryAction,
    primaryAction,
    style,
  } = props;
  const resolvedSecondaryAction = {
    isVisible: secondaryAction?.isVisible ?? true,
    icon: secondaryAction?.icon ?? DEFAULT_SECONDARY_ACTION_ICON,
    accessibilityLabel: secondaryAction?.accessibilityLabel ?? 'Reset filters',
    onPress: secondaryAction?.onPress,
  };
  const resolvedPrimaryAction = {
    isVisible: primaryAction?.isVisible ?? true,
    mode: primaryAction?.mode ?? 'responsive',
    icon: primaryAction?.icon ?? DEFAULT_PRIMARY_ACTION_ICON,
    buttonLabel: primaryAction?.buttonLabel ?? 'Filter',
    buttonAccessibilityLabel: primaryAction?.buttonAccessibilityLabel ?? 'Filter',
    iconAccessibilityLabel: primaryAction?.iconAccessibilityLabel ?? 'Filter action',
    onPress: primaryAction?.onPress,
  };
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? SAFE_AREA_INSETS_FALLBACK;
  const safeAreaTopInset = insets.top;

  const isPhoneBreakpoint = responsive.breakpoint === 'phone';
  const shouldRenderSpacer = props.variant !== 'search';
  const shouldRenderPrimaryAsIcon =
    resolvedPrimaryAction.mode === 'icon' ||
    (resolvedPrimaryAction.mode === 'responsive' && isPhoneBreakpoint);
  const shouldRenderSecondaryButton = resolvedSecondaryAction.isVisible;
  const shouldRenderPrimaryButton = resolvedPrimaryAction.isVisible;
  const shouldRenderActionsRow = shouldRenderSecondaryButton || shouldRenderPrimaryButton;
  const isSecondaryActionEnabled = typeof resolvedSecondaryAction.onPress === 'function';
  const defaultHandlePressLogo = React.useCallback(() => {
    router.push('/');
  }, [router]);

  let leadingContentProps: LeadingContentProps;

  if (props.variant === 'search') {
    leadingContentProps = {
      variant: 'search',
      searchValue: props.searchValue,
      onSearchValueChange: props.onSearchValueChange,
      onSubmitSearch: props.onSubmitSearch,
      searchPlaceholder: props.searchPlaceholder,
    };
  } else if (props.variant === 'page') {
    leadingContentProps = {
      variant: 'page',
      title: props.title,
      onPressBack: props.onPressBack,
    };
  } else {
    leadingContentProps = {
      variant: 'home',
      title: props.title,
      logoSource: props.logoSource ?? DEFAULT_HOME_LOGO,
      logoAccessibilityLabel: props.logoAccessibilityLabel ?? DEFAULT_HOME_LOGO_ACCESSIBILITY_LABEL,
      onPressLogo: props.onPressLogo ?? defaultHandlePressLogo,
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
      <View
        style={[
          styles.container,
          { paddingHorizontal: responsive.marginHorizontal },
        ]}
        accessibilityRole="header"
        testID="top-app-bar-container"
      >
        <LeadingContent
          {...leadingContentProps}
        />
        {shouldRenderSpacer ? <View style={styles.spacer} /> : null}
        {shouldRenderActionsRow ? (
          <View testID="top-app-bar-actions-row" style={styles.actionsRow}>
            {shouldRenderSecondaryButton ? (
              <IconButton
                variant="neutral"
                icon={resolvedSecondaryAction.icon}
                onPress={resolvedSecondaryAction.onPress}
                disabled={!isSecondaryActionEnabled}
                accessibilityLabel={resolvedSecondaryAction.accessibilityLabel}
              />
            ) : null}
            <PrimaryAction
              hasPrimaryButton={shouldRenderPrimaryButton}
              shouldRenderPrimaryAsIcon={shouldRenderPrimaryAsIcon}
              primaryButtonIcon={resolvedPrimaryAction.icon}
              onPressPrimaryButton={resolvedPrimaryAction.onPress}
              primaryIconButtonAccessibilityLabel={resolvedPrimaryAction.iconAccessibilityLabel}
              primaryButtonAccessibilityLabel={resolvedPrimaryAction.buttonAccessibilityLabel}
              primaryButtonLabel={resolvedPrimaryAction.buttonLabel}
            />
          </View>
        ) : null}
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
});
