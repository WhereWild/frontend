import { IconChevronLeft } from '@/assets/icons';
import { IconButton } from '@/components/buttons/IconButton';
import { SearchInput } from '@/components/inputs/SearchInput';
import { ThemedText } from '@/components/text/ThemedText';
import { Size, Time, getReactNativeEasing } from '@/constants/theme';
import {
  TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH,
  TOP_APP_BAR_LOGO_SIZE,
  TOP_APP_BAR_SEARCH_SLIDE_OFFSET,
  TOP_APP_BAR_SEARCH_TRANSITION_DURATION,
} from './TopAppBar.constants';
import type { LeadingContentProps } from './TopAppBar.types';
import { useAnimatedValueRef } from './TopAppBarAnimatedValue.native';
import React from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

type ContentTransitionStyle = {
  opacity: Animated.Value;
  transform: [{ translateX: Animated.Value }];
};

type SearchLeadingContentProps = {
  leadingSearchProps: Extract<LeadingContentProps, { variant: 'search' }>;
  contentTransitionStyle: ContentTransitionStyle;
};

type NonSearchLeadingContentProps = {
  leadingNonSearchProps: Exclude<LeadingContentProps, { variant: 'search' }>;
  contentTransitionStyle: ContentTransitionStyle;
  backSlotWidth: Animated.Value;
  backSlotOpacity: Animated.Value;
  logoSlotWidth: Animated.Value;
  logoSlotOpacity: Animated.Value;
};

/** Renders search-mode leading content with the search input. */
function SearchLeadingContent({
  leadingSearchProps,
  contentTransitionStyle,
}: SearchLeadingContentProps) {
  return (
    <Animated.View
      style={[styles.searchWrapper, contentTransitionStyle]}
      testID="top-app-bar-leading"
    >
      <SearchInput
        value={leadingSearchProps.searchValue}
        onQueryChange={leadingSearchProps.onSearchValueChange}
        onSubmitSearch={leadingSearchProps.onSubmitSearch}
        placeholder={leadingSearchProps.searchPlaceholder ?? 'Search'}
      />
    </Animated.View>
  );
}

/**
 * Renders non-search leading content (`home` or `page`) including
 * animated back/logo slots and the title.
 */
function NonSearchLeadingContent({
  leadingNonSearchProps,
  contentTransitionStyle,
  backSlotWidth,
  backSlotOpacity,
  logoSlotWidth,
  logoSlotOpacity,
}: NonSearchLeadingContentProps) {
  const shouldShowBackButton = leadingNonSearchProps.variant === 'page';
  const shouldShowLogo = leadingNonSearchProps.variant === 'home';
  const onPressBack =
    leadingNonSearchProps.variant === 'page' ? leadingNonSearchProps.onPressBack : undefined;
  const logoSource =
    leadingNonSearchProps.variant === 'home' ? leadingNonSearchProps.logoSource : undefined;
  const logoAccessibilityLabel =
    leadingNonSearchProps.variant === 'home'
      ? leadingNonSearchProps.logoAccessibilityLabel
      : undefined;
  const onPressLogo =
    leadingNonSearchProps.variant === 'home' ? leadingNonSearchProps.onPressLogo : undefined;

  return (
    <Animated.View
      collapsable={false}
      style={[styles.leadingRow, contentTransitionStyle]}
      testID="top-app-bar-leading"
    >
      <Animated.View
        collapsable={false}
        style={[
          styles.leadingSlot,
          {
            width: backSlotWidth,
            opacity: backSlotOpacity,
          },
        ]}
        pointerEvents={shouldShowBackButton ? 'auto' : 'none'}
      >
        <View
          collapsable={false}
          accessibilityElementsHidden={!shouldShowBackButton}
          importantForAccessibility={shouldShowBackButton ? 'auto' : 'no-hide-descendants'}
          pointerEvents={shouldShowBackButton ? 'auto' : 'none'}
        >
          <IconButton
            variant="subtle"
            icon={<IconChevronLeft />}
            onPress={shouldShowBackButton ? onPressBack : undefined}
            disabled={!shouldShowBackButton || typeof onPressBack !== 'function'}
            accessibilityLabel="Back"
          />
        </View>
      </Animated.View>
      <Animated.View
        collapsable={false}
        style={[
          styles.leadingSlot,
          {
            width: logoSlotWidth,
            opacity: logoSlotOpacity,
          },
        ]}
        pointerEvents={shouldShowLogo ? 'auto' : 'none'}
      >
        <View
          collapsable={false}
          accessibilityElementsHidden={!shouldShowLogo}
          importantForAccessibility={shouldShowLogo ? 'auto' : 'no-hide-descendants'}
          pointerEvents={shouldShowLogo ? 'auto' : 'none'}
        >
          <Pressable
            onPress={shouldShowLogo ? onPressLogo : undefined}
            disabled={!shouldShowLogo || typeof onPressLogo !== 'function'}
            accessibilityRole={typeof onPressLogo === 'function' ? 'button' : 'image'}
            accessibilityLabel={logoAccessibilityLabel}
            style={styles.logoPressable}
          >
            <Image
              testID="top-app-bar-home-logo-image"
              source={logoSource}
              style={styles.logo}
              resizeMode="contain"
              accessibilityRole="image"
            />
          </Pressable>
        </View>
      </Animated.View>
      <ThemedText
        variant="heading"
        numberOfLines={1}
        style={styles.title}
      >
        {leadingNonSearchProps.title}
      </ThemedText>
    </Animated.View>
  );
}

/**
 * Variant-aware leading content container that orchestrates animated
 * transitions between search and non-search modes.
 */
export function LeadingContent(props: LeadingContentProps) {
  const animationEasing = React.useMemo(() => getReactNativeEasing('in-and-out'), []);
  const [displayedProps, setDisplayedProps] = React.useState<LeadingContentProps>(props);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const latestPropsRef = React.useRef<LeadingContentProps>(props);
  const previousVariantRef = React.useRef<LeadingContentProps['variant']>(props.variant);
  const previousDisplayedVariantRef = React.useRef<LeadingContentProps['variant']>(
    displayedProps.variant,
  );
  const activeTransitionRef = React.useRef<Animated.CompositeAnimation | null>(null);
  const contentTranslateX = useAnimatedValueRef(0);
  const contentOpacity = useAnimatedValueRef(1);

  latestPropsRef.current = props;

  React.useEffect(() => {
    const latestProps = latestPropsRef.current;
    const previousVariant = previousVariantRef.current;
    previousVariantRef.current = latestProps.variant;

    if (previousVariant === latestProps.variant) {
      setDisplayedProps(latestProps);
      setIsTransitioning(false);
      contentTranslateX.current.setValue(0);
      contentOpacity.current.setValue(1);
      return;
    }

    // Stop any in-flight transition before starting a new one so stale
    // completion callbacks cannot apply an out-of-date variant state.
    activeTransitionRef.current?.stop();
    setIsTransitioning(true);
    const nextProps = latestProps;
    const isEnteringPageVariant = nextProps.variant === 'page';
    const exitTranslateX = isEnteringPageVariant
      ? -TOP_APP_BAR_SEARCH_SLIDE_OFFSET
      : TOP_APP_BAR_SEARCH_SLIDE_OFFSET;
    const enterStartTranslateX = isEnteringPageVariant
      ? TOP_APP_BAR_SEARCH_SLIDE_OFFSET
      : -TOP_APP_BAR_SEARCH_SLIDE_OFFSET;

    const exitAnimation = Animated.parallel([
      Animated.timing(contentTranslateX.current, {
        toValue: exitTranslateX,
        duration: TOP_APP_BAR_SEARCH_TRANSITION_DURATION,
        easing: animationEasing,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity.current, {
        toValue: 0,
        duration: TOP_APP_BAR_SEARCH_TRANSITION_DURATION,
        easing: animationEasing,
        useNativeDriver: true,
      }),
    ]);

    activeTransitionRef.current = exitAnimation;
    exitAnimation.start(({ finished }) => {
      if (!finished) {
        return;
      }

      setDisplayedProps(nextProps);
      contentTranslateX.current.setValue(enterStartTranslateX);
      contentOpacity.current.setValue(0);

      const enterAnimation = Animated.parallel([
        Animated.timing(contentTranslateX.current, {
          toValue: 0,
          duration: TOP_APP_BAR_SEARCH_TRANSITION_DURATION,
          easing: animationEasing,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity.current, {
          toValue: 1,
          duration: TOP_APP_BAR_SEARCH_TRANSITION_DURATION,
          easing: animationEasing,
          useNativeDriver: true,
        }),
      ]);

      activeTransitionRef.current = enterAnimation;
      enterAnimation.start(() => {
        activeTransitionRef.current = null;
        setIsTransitioning(false);
      });
    });
  }, [animationEasing, contentOpacity, contentTranslateX, props.variant]);

  React.useEffect(() => {
    return () => {
      activeTransitionRef.current?.stop();
    };
  }, []);

  const logoSlotWidth = useAnimatedValueRef(
    displayedProps.variant === 'home' ? TOP_APP_BAR_LOGO_SIZE : 0,
  );
  const logoSlotOpacity = useAnimatedValueRef(displayedProps.variant === 'home' ? 1 : 0);
  const backSlotWidth = useAnimatedValueRef(
    displayedProps.variant === 'page' ? TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH : 0,
  );
  const backSlotOpacity = useAnimatedValueRef(displayedProps.variant === 'page' ? 1 : 0);

  React.useEffect(() => {
    const previousDisplayedVariant = previousDisplayedVariantRef.current;
    const nextDisplayedVariant = displayedProps.variant;
    previousDisplayedVariantRef.current = nextDisplayedVariant;

    const showLogo = displayedProps.variant === 'home';
    const showBack = displayedProps.variant === 'page';

    const isEnteringFromSearch =
      previousDisplayedVariant === 'search' && nextDisplayedVariant !== 'search';
    const isDirectNonSearchSwap =
      previousDisplayedVariant !== 'search' &&
      nextDisplayedVariant !== 'search' &&
      previousDisplayedVariant !== nextDisplayedVariant;

    if (isEnteringFromSearch || isDirectNonSearchSwap) {
      logoSlotWidth.current.setValue(showLogo ? TOP_APP_BAR_LOGO_SIZE : 0);
      logoSlotOpacity.current.setValue(showLogo ? 1 : 0);
      backSlotWidth.current.setValue(showBack ? TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH : 0);
      backSlotOpacity.current.setValue(showBack ? 1 : 0);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(logoSlotWidth.current, {
        toValue: showLogo ? TOP_APP_BAR_LOGO_SIZE : 0,
        duration: Time.duration.short,
        easing: animationEasing,
        useNativeDriver: false,
      }),
      Animated.timing(logoSlotOpacity.current, {
        toValue: showLogo ? 1 : 0,
        duration: Time.duration.short,
        easing: animationEasing,
        useNativeDriver: false,
      }),
      Animated.timing(backSlotWidth.current, {
        toValue: showBack ? TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH : 0,
        duration: Time.duration.short,
        easing: animationEasing,
        useNativeDriver: false,
      }),
      Animated.timing(backSlotOpacity.current, {
        toValue: showBack ? 1 : 0,
        duration: Time.duration.short,
        easing: animationEasing,
        useNativeDriver: false,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [
    animationEasing,
    backSlotOpacity,
    backSlotWidth,
    displayedProps.variant,
    logoSlotOpacity,
    logoSlotWidth,
  ]);

  const transitionStyle: ContentTransitionStyle = {
    opacity: contentOpacity.current,
    transform: [{ translateX: contentTranslateX.current }],
  };

  if (displayedProps.variant === 'search') {
    // Prefer live search props while actively in search so input value/handlers
    // stay current, but fall back to displayed props during exit transitions.
    const leadingSearchProps =
      !isTransitioning && props.variant === 'search' ? props : displayedProps;

    return (
      <SearchLeadingContent
        leadingSearchProps={leadingSearchProps}
        contentTransitionStyle={transitionStyle}
      />
    );
  }

  // Prefer live non-search props while actively in home/page, but fall back to
  // displayed props during search-exit transitions until swap is complete.
  const leadingNonSearchProps =
    !isTransitioning && props.variant !== 'search' ? props : displayedProps;

  return (
    <NonSearchLeadingContent
      leadingNonSearchProps={leadingNonSearchProps}
      contentTransitionStyle={transitionStyle}
      backSlotWidth={backSlotWidth.current}
      backSlotOpacity={backSlotOpacity.current}
      logoSlotWidth={logoSlotWidth.current}
      logoSlotOpacity={logoSlotOpacity.current}
    />
  );
}

const styles = StyleSheet.create({
  leadingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
    minWidth: 0,
  },
  logo: {
    width: TOP_APP_BAR_LOGO_SIZE,
    height: TOP_APP_BAR_LOGO_SIZE,
  },
  leadingSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPressable: {
    borderRadius: Size.radius['full'],
  },
  searchWrapper: {
    flex: 1,
    minWidth: 0,
  },
});
