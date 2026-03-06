import {
  IconHelpCircle,
  IconInfo,
  IconSettings,
} from '@/assets/icons';
import { Colors, Shadows, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  useWindowDimensions,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Button } from '../../buttons/Button';
import { ThemedText } from '../../text/ThemedText';
import { SpeciesSummary } from '@/data/types';
import { toKebabCase } from '@/utils/string';
import { useWebPageHeaderMobileMenu } from './useWebPageHeaderMobileMenu';
import { useWebPageHeaderSearch } from './useWebPageHeaderSearch';
import { useWebPageHeaderSearchLayout } from './useWebPageHeaderSearchLayout';
import { WebPageHeaderSearchResults } from './WebPageHeaderSearchResults';
import { WebPageHeaderSearchRow } from './WebPageHeaderSearchRow';
import { WebPageHeaderMobileMenu } from './WebPageHeaderMobileMenu';
import type { WebPageHeaderAction, SearchInputPassthroughProps } from './types';
import type { SearchFilterParams } from '@/data/api';

export type { WebPageHeaderAction } from './types';

/** Public props for the WebPageHeader composition. */
export type WebPageHeaderProps = {
  title?: string;
  logoSource?: ImageSourcePropType;
  logoAccessibilityLabel?: string;
  searchPlaceholder?: string;
  searchInputProps?: SearchInputPassthroughProps;
  actions?: WebPageHeaderAction[];
  showFilterButton?: boolean;
  onFilterPress?: () => void;
  filterLabel?: string;
  filterButtonAccessibilityLabel?: string;
  showResetFilterButton?: boolean;
  onResetFilterPress?: () => void;
  resetFilterButtonAccessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  showSearchResultsDropdown?: boolean;
  initialQuery?: string;
  /** Filter parameters forwarded to the species search API. */
  filterParams?: SearchFilterParams;
  onSearchingChanged?: (searching: boolean) => void;
  onSearchResultsChanged?: (results: SpeciesSummary[]) => void;
  onSearchContextChanged?: (message: string | null) => void;
};

const DEFAULT_LOGO = require('@/assets/images/wherewild.png');

/**
 * App-level header with navigation actions, search input, and optional compact menu.
 * Composes focused helpers for search state, search overlay layout, and mobile menu behavior.
 */
export function WebPageHeader({
  title = 'WhereWild',
  logoSource = DEFAULT_LOGO,
  searchPlaceholder = 'Search',
  searchInputProps,
  actions,
  showFilterButton = true,
  onFilterPress,
  filterLabel = 'Filter',
  filterButtonAccessibilityLabel = 'Filter search results',
  showResetFilterButton = true,
  onResetFilterPress,
  resetFilterButtonAccessibilityLabel = 'Reset filters',
  style,
  logoAccessibilityLabel = 'Go to home',
  showSearchResultsDropdown = true,
  initialQuery,
  filterParams,
  onSearchingChanged,
  onSearchResultsChanged,
  onSearchContextChanged,
}: WebPageHeaderProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const isCompact = responsive.breakpoint !== 'desktop';
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const window = useWindowDimensions();
  const menuButtonRef = React.useRef<View>(null);
  const router = useRouter();
  const pathname = usePathname();
  const navigateIfDifferent = React.useCallback((targetPath: '/' | '/about') => {
    if (pathname !== targetPath) {
      router.push(targetPath);
    }
  }, [pathname, router]);

  const navigateHome = React.useCallback(() => {
    navigateIfDifferent('/');
  }, [navigateIfDifferent]);

  const navigateToAbout = React.useCallback(() => {
    navigateIfDifferent('/about');
  }, [navigateIfDifferent]);

  const navigateToSettings = React.useCallback(() => {
    if (pathname !== '/settings') {
      router.push('/settings');
    }
  }, [pathname, router]);

  /** Submits non-empty queries and avoids redundant navigation when already on `/search`. */
  const submitSearchQuery = React.useCallback((query: string) => {
    const trimmed = query.trim();
    if (trimmed === '') {
      return;
    }

    if (pathname === '/search') {
      return;
    }

    router.push({ pathname: '/search', params: { query: trimmed } });
  }, [pathname, router]);
  const defaultActions = React.useMemo<WebPageHeaderAction[]>(
    () => [
      { label: 'Help', icon: <IconHelpCircle /> },
      { label: 'About', icon: <IconInfo />, onPress: navigateToAbout },
      { label: 'Settings', icon: <IconSettings />, onPress: navigateToSettings },
    ],
    [navigateToAbout, navigateToSettings],
  );
  const resolvedActions = actions ?? defaultActions;
  const logoContent = (
    <>
      <Image
        source={logoSource}
        style={isCompact ? styles.logoMobile : styles.logo}
        resizeMode="contain"
        accessibilityLabel="WhereWild logo"
      />
      {!isCompact ? (
        <ThemedText variant="heading">
          {title}
        </ThemedText>
      ) : null}
    </>
  );

  const {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    searchResults,
    searching,
    searchError,
    isSearchBarFocused,
    setIsSearchBarFocused,
    isSearchBlurGraceActive,
    cancelSearchBlurGrace,
    startSearchBlurGrace,
  } = useWebPageHeaderSearch({
    initialQuery,
    filterParams,
    onSearchingChanged,
    onSearchResultsChanged,
    onSearchContextChanged,
  });

  const hasQuery = debouncedQuery.length > 0;

  const {
    searchResultsVisible,
    getSearchResultsStyle,
    setWrapperHeight,
    setMobileHeaderLayout,
  } = useWebPageHeaderSearchLayout({
    marginHorizontal: responsive.marginHorizontal,
    hasQuery,
    showSearchResultsDropdown,
    isSearchBarFocused,
    isSearchBlurGraceActive,
  });

  const {
    isMenuOpen,
    menuAnchor,
    toggleMenu,
    closeMenu,
  } = useWebPageHeaderMobileMenu({
    isCompact,
    menuButtonRef,
    windowWidth: window.width,
  });

  const handleSelectSearchResult = React.useCallback((s: SpeciesSummary) => {
    cancelSearchBlurGrace();
    const segment = toKebabCase(s.scientificName.trim());
    if (segment) {
      router.push({
        pathname: '/species/[...identifier]',
        params: { identifier: [s.taxonId.toString(), segment] },
      });
    }
  }, [cancelSearchBlurGrace, router]);

  const handleSearchFocus = React.useCallback(() => {
    cancelSearchBlurGrace();
    setIsSearchBarFocused(true);
  }, [cancelSearchBlurGrace, setIsSearchBarFocused]);

  const handleSearchBlur = React.useCallback(() => {
    setIsSearchBarFocused(false);
    startSearchBlurGrace();
  }, [setIsSearchBarFocused, startSearchBlurGrace]);

  const desktopSearchResults = (
    <WebPageHeaderSearchResults
      isVisible={searchResultsVisible}
      results={searchResults}
      isLoading={searching}
      errorMessage={searchError}
      style={getSearchResultsStyle('desktop')}
      onSelectResult={handleSelectSearchResult}
    />
  );

  return (
    <View
      style={[
        styles.container,
        isCompact ? { marginTop: insets.top } : null,
        style,
      ]}
      accessibilityRole="header"
    >
      <View
        style={[
          styles.surface,
          { pointerEvents: 'none' },
          {
            backgroundColor: palette.background.default.secondary,
          },
          Shadows.dropShadow200.style,
        ]}
      />
      <View
        style={[
          styles.content,
          isCompact ? styles.containerMobile : styles.containerDesktop,
        ]}
      >
        {isCompact ? (
          <>
            <View
              style={styles.mobileHeaderRow}
              onLayout={(e) => {
                const { y, height } = e.nativeEvent.layout;
                setMobileHeaderLayout({ y, height });
              }}
            >
              <Pressable
                onPress={navigateHome}
                style={styles.logoSectionMobile}
                accessibilityRole="link"
                accessibilityLabel={logoAccessibilityLabel}
              >
                {logoContent}
              </Pressable>

              <WebPageHeaderSearchRow
                variant="mobile"
                searchInputProps={searchInputProps}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSubmitSearch={submitSearchQuery}
                searchPlaceholder={searchPlaceholder}
                onSearchFocus={handleSearchFocus}
                onSearchBlur={handleSearchBlur}
                onSearchWrapperLayout={setWrapperHeight}
                desktopSearchResults={desktopSearchResults}
                showFilterButton={showFilterButton}
                onFilterPress={onFilterPress}
                filterLabel={filterLabel}
                filterButtonAccessibilityLabel={filterButtonAccessibilityLabel}
                showResetFilterButton={showResetFilterButton}
                onResetFilterPress={onResetFilterPress}
                resetFilterButtonAccessibilityLabel={resetFilterButtonAccessibilityLabel}
              />

              <WebPageHeaderMobileMenu
                actions={resolvedActions}
                menuButtonRef={menuButtonRef}
                isMenuOpen={isMenuOpen}
                onToggleMenu={toggleMenu}
                onCloseMenu={closeMenu}
                menuAnchor={menuAnchor}
                insetsTop={insets.top}
                backgroundColor={palette.background.default.tertiary}
                borderColor={palette.border.default.tertiary}
              />
            </View>

            <WebPageHeaderSearchResults
              isVisible={searchResultsVisible}
              results={searchResults}
              isLoading={searching}
              errorMessage={searchError}
              style={getSearchResultsStyle('mobile')}
              onSelectResult={handleSelectSearchResult}
            />
          </>
        ) : (
          <>
            <Pressable
              onPress={navigateHome}
              style={styles.logoSection}
              accessibilityRole="link"
              accessibilityLabel={logoAccessibilityLabel}
            >
              {logoContent}
            </Pressable>

            <WebPageHeaderSearchRow
              variant="desktop"
              searchInputProps={searchInputProps}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSubmitSearch={submitSearchQuery}
              searchPlaceholder={searchPlaceholder}
              onSearchFocus={handleSearchFocus}
              onSearchBlur={handleSearchBlur}
              onSearchWrapperLayout={setWrapperHeight}
              desktopSearchResults={desktopSearchResults}
              showFilterButton={showFilterButton}
              onFilterPress={onFilterPress}
              filterLabel={filterLabel}
              filterButtonAccessibilityLabel={filterButtonAccessibilityLabel}
              showResetFilterButton={showResetFilterButton}
              onResetFilterPress={onResetFilterPress}
              resetFilterButtonAccessibilityLabel={resetFilterButtonAccessibilityLabel}
            />

            <View style={styles.actionsWrapper}>
              {resolvedActions.map(({ label, icon, onPress, variant = 'subtle' }) => (
                <Button
                  key={label}
                  variant={variant}
                  onPress={onPress}
                  iconStart={icon}
                  label={label}
                />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 9999,
    position: 'relative',
  },
  surface: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  containerDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: Size.space['800'],
    paddingVertical: Size.space['200'],
    gap: Size.space['400'],
  },
  containerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['400'],
    gap: Size.space['200'],
  },
  mobileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
    width: '100%',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  logoSectionMobile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: Size.space['1600'],
    height: Size.space['1600'],
  },
  logoMobile: {
    width: Size.control.dimension.large,
    height: Size.control.dimension.large,
  },
  actionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
});
