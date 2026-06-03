// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

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
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';

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

const NOOP = () => {};
const NOOP_SEARCH_HANDLER = (_value: string) => {};
const FALLBACK_SEARCH_PROPS: Extract<
  LeadingContentProps,
  { variant: 'search' }
> = {
  variant: 'search',
  searchValue: '',
  onSearchValueChange: NOOP_SEARCH_HANDLER,
  onSubmitSearch: NOOP_SEARCH_HANDLER,
};
const FALLBACK_NON_SEARCH_PROPS: Exclude<
  LeadingContentProps,
  { variant: 'search' }
> = {
  variant: 'page',
  title: '',
  onPressBack: NOOP,
};

/** Renders search-mode leading content with the search input. */
function SearchLeadingContent({
  leadingSearchProps,
  contentTransitionStyle,
}: SearchLeadingContentProps) {
  return (
    <Animated.View style={[styles.searchWrapper, contentTransitionStyle]}>
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
    leadingNonSearchProps.variant === 'page'
      ? leadingNonSearchProps.onPressBack
      : undefined;
  const logoSource =
    leadingNonSearchProps.variant === 'home'
      ? leadingNonSearchProps.logoSource
      : undefined;
  const logoAccessibilityLabel =
    leadingNonSearchProps.variant === 'home'
      ? leadingNonSearchProps.logoAccessibilityLabel
      : undefined;
  const onPressLogo =
    leadingNonSearchProps.variant === 'home'
      ? leadingNonSearchProps.onPressLogo
      : undefined;

  return (
    <Animated.View
      collapsable={false}
      style={[styles.leadingRow, contentTransitionStyle]}
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
          importantForAccessibility={
            shouldShowBackButton ? 'auto' : 'no-hide-descendants'
          }
          pointerEvents={shouldShowBackButton ? 'auto' : 'none'}
          style={styles.leadingSlotContent}
        >
          <IconButton
            variant='subtle'
            icon={<IconChevronLeft />}
            onPress={shouldShowBackButton ? onPressBack : undefined}
            disabled={
              !shouldShowBackButton || typeof onPressBack !== 'function'
            }
            accessibilityLabel='Back'
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
          importantForAccessibility={
            shouldShowLogo ? 'auto' : 'no-hide-descendants'
          }
          pointerEvents={shouldShowLogo ? 'auto' : 'none'}
          style={styles.leadingSlotContent}
        >
          <Pressable
            onPress={shouldShowLogo ? onPressLogo : undefined}
            disabled={!shouldShowLogo || typeof onPressLogo !== 'function'}
            accessibilityRole={
              typeof onPressLogo === 'function' ? 'button' : 'image'
            }
            accessibilityLabel={logoAccessibilityLabel}
            style={styles.logoPressable}
          >
            <Image
              testID='top-app-bar-home-logo-image'
              source={logoSource}
              style={styles.logo}
              resizeMode='contain'
              accessibilityRole='image'
            />
          </Pressable>
        </View>
      </Animated.View>
      <ThemedText variant='heading' numberOfLines={1} style={styles.title}>
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
  const animationEasing = React.useMemo(
    () => getReactNativeEasing('in-and-out'),
    [],
  );
  const [displayedProps, setDisplayedProps] =
    React.useState<LeadingContentProps>(props);
  const [, setIsTransitioning] = React.useState(false);
  const latestPropsRef = React.useRef<LeadingContentProps>(props);
  const lastSearchPropsRef = React.useRef<
    Extract<LeadingContentProps, { variant: 'search' }>
  >(props.variant === 'search' ? props : FALLBACK_SEARCH_PROPS);
  const lastNonSearchPropsRef = React.useRef<
    Exclude<LeadingContentProps, { variant: 'search' }>
  >(props.variant !== 'search' ? props : FALLBACK_NON_SEARCH_PROPS);
  const previousVariantRef = React.useRef<LeadingContentProps['variant']>(
    props.variant,
  );
  const previousDisplayedVariantRef = React.useRef<
    LeadingContentProps['variant']
  >(displayedProps.variant);
  const activeTransitionRef = React.useRef<Animated.CompositeAnimation | null>(
    null,
  );
  const contentTranslateX = useAnimatedValueRef(0);
  const contentOpacity = useAnimatedValueRef(1);

  latestPropsRef.current = props;

  if (props.variant === 'search') {
    lastSearchPropsRef.current = props;
  } else {
    lastNonSearchPropsRef.current = props;
  }

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
  const logoSlotOpacity = useAnimatedValueRef(
    displayedProps.variant === 'home' ? 1 : 0,
  );
  const backSlotWidth = useAnimatedValueRef(
    displayedProps.variant === 'page' ? TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH : 0,
  );
  const backSlotOpacity = useAnimatedValueRef(
    displayedProps.variant === 'page' ? 1 : 0,
  );

  React.useEffect(() => {
    const previousDisplayedVariant = previousDisplayedVariantRef.current;
    const nextDisplayedVariant = displayedProps.variant;
    previousDisplayedVariantRef.current = nextDisplayedVariant;

    const showLogo = displayedProps.variant === 'home';
    const showBack = displayedProps.variant === 'page';

    const isEnteringFromSearch =
      previousDisplayedVariant === 'search' &&
      nextDisplayedVariant !== 'search';
    const isDirectNonSearchSwap =
      previousDisplayedVariant !== 'search' &&
      nextDisplayedVariant !== 'search' &&
      previousDisplayedVariant !== nextDisplayedVariant;

    if (isEnteringFromSearch || isDirectNonSearchSwap) {
      logoSlotWidth.current.setValue(showLogo ? TOP_APP_BAR_LOGO_SIZE : 0);
      logoSlotOpacity.current.setValue(showLogo ? 1 : 0);
      backSlotWidth.current.setValue(
        showBack ? TOP_APP_BAR_ACTION_ICON_SLOT_WIDTH : 0,
      );
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
  const isSearchVisible = displayedProps.variant === 'search';
  const leadingSearchProps =
    props.variant === 'search' ? props : lastSearchPropsRef.current;
  const leadingNonSearchProps =
    props.variant !== 'search' ? props : lastNonSearchPropsRef.current;

  return (
    <View style={styles.leadingContainer}>
      <View
        collapsable={false}
        testID='top-app-bar-leading-search-slot'
        accessibilityElementsHidden={!isSearchVisible}
        importantForAccessibility={
          isSearchVisible ? 'auto' : 'no-hide-descendants'
        }
        pointerEvents={isSearchVisible ? 'auto' : 'none'}
        style={[
          styles.leadingContentSlot,
          !isSearchVisible && styles.leadingContentSlotHidden,
        ]}
      >
        <SearchLeadingContent
          leadingSearchProps={leadingSearchProps}
          contentTransitionStyle={transitionStyle}
        />
      </View>
      <View
        collapsable={false}
        testID='top-app-bar-leading-non-search-slot'
        accessibilityElementsHidden={isSearchVisible}
        importantForAccessibility={
          isSearchVisible ? 'no-hide-descendants' : 'auto'
        }
        pointerEvents={isSearchVisible ? 'none' : 'auto'}
        style={[
          styles.leadingContentSlot,
          isSearchVisible && styles.leadingContentSlotHidden,
        ]}
      >
        <NonSearchLeadingContent
          leadingNonSearchProps={leadingNonSearchProps}
          contentTransitionStyle={transitionStyle}
          backSlotWidth={backSlotWidth.current}
          backSlotOpacity={backSlotOpacity.current}
          logoSlotWidth={logoSlotWidth.current}
          logoSlotOpacity={logoSlotOpacity.current}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leadingContainer: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  leadingContentSlot: {
    ...StyleSheet.absoluteFillObject,
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 0,
  },
  leadingContentSlotHidden: {
    opacity: 0,
  },
  leadingRow: {
    flex: 1,
    height: '100%',
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
  leadingSlotContent: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPressable: {
    borderRadius: Size.radius['full'],
  },
  searchWrapper: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    minWidth: 0,
  },
});
