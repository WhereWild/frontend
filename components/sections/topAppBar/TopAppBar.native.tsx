import { IconFilter, IconRotateCcw } from '@/assets/icons';
import { IconButton } from '@/components/buttons/IconButton';
import { Colors, Shadows, Size, Time, getReactNativeEasing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import {
  TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH,
  TOP_APP_BAR_SEARCH_TRANSITION_DURATION,
} from './TopAppBar.constants';
import { LeadingContent } from './TopAppBarLeadingContent.native';
import { PrimaryAction } from './TopAppBarPrimaryAction.native';
import type {
  LeadingContentProps,
  PrimaryActionProps,
  TopAppBarProps,
} from './TopAppBar.types';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Animated,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

export type { TopAppBarProps, TopAppBarVariant } from './TopAppBar.types';

const SAFE_AREA_INSETS_FALLBACK = { top: 0, bottom: 0, left: 0, right: 0 };
const DEFAULT_SECONDARY_ACTION_ICON = <IconRotateCcw />;
const DEFAULT_PRIMARY_ACTION_ICON = <IconFilter />;
const DEFAULT_HOME_LOGO = require('@/assets/images/wherewild.png');
const DEFAULT_HOME_LOGO_ACCESSIBILITY_LABEL = 'Go to home';

type ResolvedSecondaryAction = {
  isVisible: boolean;
  icon: React.ReactNode;
  accessibilityLabel: string;
  onPress?: () => void;
};

type ResolvedPrimaryAction = {
  isVisible: boolean;
  mode: 'responsive' | 'icon' | 'button';
  icon: PrimaryActionProps['primaryButtonIcon'];
  buttonLabel: string;
  buttonAccessibilityLabel: string;
  iconAccessibilityLabel: string;
  onPress?: () => void;
};

type TopAppBarActionsRowProps = {
  isSecondaryButtonVisible: boolean;
  resolvedSecondaryAction: ResolvedSecondaryAction;
  isSecondaryActionEnabled: boolean;
  secondaryActionWidth: Animated.Value;
  secondaryActionOpacity: Animated.Value;
  isPrimaryButtonVisible: boolean;
  isPrimaryIconMode: boolean;
  resolvedPrimaryAction: ResolvedPrimaryAction;
};

/**
 * Normalizes optional secondary action config into a fully-resolved shape
 * with stable defaults for visibility, icon, label, and press handler.
 */
const resolveSecondaryAction = (
  secondaryAction: TopAppBarProps['secondaryAction'],
): ResolvedSecondaryAction => ({
  isVisible: secondaryAction?.isVisible ?? true,
  icon: secondaryAction?.icon ?? DEFAULT_SECONDARY_ACTION_ICON,
  accessibilityLabel: secondaryAction?.accessibilityLabel ?? 'Reset filters',
  onPress: secondaryAction?.onPress,
});

/**
 * Normalizes optional primary action config into a fully-resolved shape used
 * by the action row and `PrimaryAction` renderer.
 */
const resolvePrimaryAction = (
  primaryAction: TopAppBarProps['primaryAction'],
): ResolvedPrimaryAction => ({
  isVisible: primaryAction?.isVisible ?? true,
  mode: primaryAction?.mode ?? 'responsive',
  icon: primaryAction?.icon ?? DEFAULT_PRIMARY_ACTION_ICON,
  buttonLabel: primaryAction?.buttonLabel ?? 'Filter',
  buttonAccessibilityLabel: primaryAction?.buttonAccessibilityLabel ?? 'Filter',
  iconAccessibilityLabel: primaryAction?.iconAccessibilityLabel ?? 'Filter action',
  onPress: primaryAction?.onPress,
});

/**
 * Maps variant-specific top app bar props into the corresponding leading
 * content props (`home`, `page`, or `search`) with sensible defaults.
 */
const resolveLeadingContentProps = (
  props: TopAppBarProps,
  defaultHandlePressLogo: () => void,
): LeadingContentProps => {
  if (props.variant === 'search') {
    return {
      variant: 'search',
      searchValue: props.searchValue,
      onSearchValueChange: props.onSearchValueChange,
      onSubmitSearch: props.onSubmitSearch,
      searchPlaceholder: props.searchPlaceholder,
    };
  }

  if (props.variant === 'page') {
    return {
      variant: 'page',
      title: props.title,
      onPressBack: props.onPressBack,
    };
  }

  return {
    variant: 'home',
    title: props.title,
    logoSource: props.logoSource ?? DEFAULT_HOME_LOGO,
    logoAccessibilityLabel: props.logoAccessibilityLabel ?? DEFAULT_HOME_LOGO_ACCESSIBILITY_LABEL,
    onPressLogo: props.onPressLogo ?? defaultHandlePressLogo,
  };
};

/**
 * Renders the right-side actions row, including animated secondary slot
 * behavior and the primary action (icon or button mode).
 */
function TopAppBarActionsRow({
  isSecondaryButtonVisible,
  resolvedSecondaryAction,
  isSecondaryActionEnabled,
  secondaryActionWidth,
  secondaryActionOpacity,
  isPrimaryButtonVisible,
  isPrimaryIconMode,
  resolvedPrimaryAction,
}: TopAppBarActionsRowProps) {
  return (
    <View testID="top-app-bar-actions-row" style={styles.actionsRow}>
      <Animated.View
        testID="top-app-bar-secondary-action-slot"
        style={[
          styles.secondaryActionSlot,
          {
            width: secondaryActionWidth,
            opacity: secondaryActionOpacity,
          },
        ]}
        pointerEvents={isSecondaryButtonVisible ? 'auto' : 'none'}
      >
        <IconButton
          variant="neutral"
          icon={resolvedSecondaryAction.icon}
          onPress={resolvedSecondaryAction.onPress}
          disabled={!isSecondaryActionEnabled}
          accessibilityLabel={resolvedSecondaryAction.accessibilityLabel}
        />
      </Animated.View>
      <PrimaryAction
        hasPrimaryButton={isPrimaryButtonVisible}
        shouldRenderPrimaryAsIcon={isPrimaryIconMode}
        primaryButtonIcon={resolvedPrimaryAction.icon}
        onPressPrimaryButton={resolvedPrimaryAction.onPress}
        primaryIconButtonAccessibilityLabel={resolvedPrimaryAction.iconAccessibilityLabel}
        primaryButtonAccessibilityLabel={resolvedPrimaryAction.buttonAccessibilityLabel}
        primaryButtonLabel={resolvedPrimaryAction.buttonLabel}
      />
    </View>
  );
}

/**
 * Native top app bar container that composes leading content and action
 * controls, and coordinates variant/action visibility transitions.
 */
export function TopAppBar(props: TopAppBarProps) {
  const router = useRouter();
  const { style } = props;
  const resolvedSecondaryAction = React.useMemo(
    () => resolveSecondaryAction(props.secondaryAction),
    [props.secondaryAction],
  );
  const resolvedPrimaryAction = React.useMemo(
    () => resolvePrimaryAction(props.primaryAction),
    [props.primaryAction],
  );
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? SAFE_AREA_INSETS_FALLBACK;
  const safeAreaTopInset = insets.top;
  const previousVariantRef = React.useRef(props.variant);

  const isPhoneBreakpoint = responsive.breakpoint === 'phone';
  const [shouldRenderSpacer, setShouldRenderSpacer] = React.useState(props.variant !== 'search');
  const isPrimaryIconMode =
    resolvedPrimaryAction.mode === 'icon' ||
    (resolvedPrimaryAction.mode === 'responsive' && isPhoneBreakpoint);
  const isSecondaryButtonVisible = resolvedSecondaryAction.isVisible;
  const isPrimaryButtonVisible = resolvedPrimaryAction.isVisible;
  const shouldRenderAnyAction = isSecondaryButtonVisible || isPrimaryButtonVisible;
  const isSecondaryActionEnabled = typeof resolvedSecondaryAction.onPress === 'function';
  const [shouldKeepActionsRowMounted, setShouldKeepActionsRowMounted] = React.useState(
    shouldRenderAnyAction,
  );
  const animationEasing = React.useMemo(() => getReactNativeEasing('in-and-out'), []);
  const secondaryActionWidth = React.useRef(
    new Animated.Value(isSecondaryButtonVisible ? TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH : 0),
  );
  const secondaryActionOpacity = React.useRef(
    new Animated.Value(isSecondaryButtonVisible ? 1 : 0),
  );

  React.useEffect(() => {
    const wasSearchVariant = previousVariantRef.current === 'search';
    const isSearchVariant = props.variant === 'search';
    previousVariantRef.current = props.variant;

    if (wasSearchVariant === isSearchVariant) {
      setShouldRenderSpacer(!isSearchVariant);
      return;
    }

    const timeout = setTimeout(() => {
      setShouldRenderSpacer(!isSearchVariant);
    }, TOP_APP_BAR_SEARCH_TRANSITION_DURATION);

    return () => {
      clearTimeout(timeout);
    };
  }, [props.variant]);

  React.useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (shouldRenderAnyAction) {
      setShouldKeepActionsRowMounted(true);
    } else {
      timeout = setTimeout(() => {
        setShouldKeepActionsRowMounted(false);
      }, Time.duration.short);
    }

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [shouldRenderAnyAction]);

  React.useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(secondaryActionWidth.current, {
        toValue: isSecondaryButtonVisible ? TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH : 0,
        duration: Time.duration.short,
        easing: animationEasing,
        useNativeDriver: false,
      }),
      Animated.timing(secondaryActionOpacity.current, {
        toValue: isSecondaryButtonVisible ? 1 : 0,
        duration: Time.duration.short,
        easing: animationEasing,
        useNativeDriver: false,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [animationEasing, isSecondaryButtonVisible]);

  const defaultHandlePressLogo = React.useCallback(() => {
    router.push('/');
  }, [router]);
  const leadingContentProps = resolveLeadingContentProps(props, defaultHandlePressLogo);

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
        {shouldKeepActionsRowMounted ? (
          <TopAppBarActionsRow
            isSecondaryButtonVisible={isSecondaryButtonVisible}
            resolvedSecondaryAction={resolvedSecondaryAction}
            isSecondaryActionEnabled={isSecondaryActionEnabled}
            secondaryActionWidth={secondaryActionWidth.current}
            secondaryActionOpacity={secondaryActionOpacity.current}
            isPrimaryButtonVisible={isPrimaryButtonVisible}
            isPrimaryIconMode={isPrimaryIconMode}
            resolvedPrimaryAction={resolvedPrimaryAction}
          />
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
    height: Size.bar.height.short,
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
  secondaryActionSlot: {
    overflow: 'hidden',
  },
});
