// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  IconHelpCircle,
  IconInfo,
  IconSettings,
  IconUpload,
} from '@/assets/icons';
import { Colors, Shadows, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { usePathname, useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  LayoutChangeEvent,
  useWindowDimensions,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { Button } from '../../buttons/Button';
import type { SearchInputKeyDownEvent } from '../../inputs/SearchInput';
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
import type { SearchTaxaQueryFilters } from '@/data/api';
import { RoutePressable } from '@/components/navigation/RoutePressable';

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
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  /** Filter parameters forwarded to the unified taxa query API. */
  filterParams?: SearchTaxaQueryFilters;
  onLayout?: (event: LayoutChangeEvent) => void;
};

const DEFAULT_LOGO_LIGHT = require('@/assets/images/wherewild.png');
const DEFAULT_LOGO_DARK = require('@/assets/images/wherewild-dark-background.png');

/**
 * App-level header with navigation actions, search input, and optional compact menu.
 * Composes focused helpers for search state, search overlay layout, and mobile menu behavior.
 */
export function WebPageHeader({
  title = 'WhereWild',
  logoSource,
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
  searchQuery: controlledSearchQuery,
  onSearchQueryChange,
  filterParams,
  onLayout,
}: WebPageHeaderProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const resolvedLogoSource =
    logoSource ?? (mode === 'dark' ? DEFAULT_LOGO_DARK : DEFAULT_LOGO_LIGHT);
  const responsive = useResponsive();
  const isCompact = responsive.breakpoint !== 'desktop';
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const window = useWindowDimensions();
  const menuButtonRef = React.useRef<View>(null);
  const router = useRouter();
  const pathname = usePathname();

  /** Navigates to the search page and includes a query param only when non-empty. */
  const submitSearchQuery = React.useCallback(
    (query: string) => {
      const trimmed = query.trim();

      if (trimmed === '') {
        if (pathname !== '/search') {
          router.push('/search');
        }
        return;
      }

      if (pathname === '/search') {
        return;
      }

      router.push({ pathname: '/search', params: { query: trimmed } });
    },
    [pathname, router],
  );
  const defaultActions = React.useMemo<WebPageHeaderAction[]>(
    () => [
      {
        label: 'Help',
        icon: <IconHelpCircle />,
        href: '/help',
        hrefPath: '/help',
      },
      {
        label: 'About',
        icon: <IconInfo />,
        href: '/about',
        hrefPath: '/about',
      },
      {
        label: 'Upload',
        icon: <IconUpload />,
        href: '/upload',
        hrefPath: '/upload',
      },
      {
        label: 'Settings',
        icon: <IconSettings />,
        href: '/settings',
        hrefPath: '/settings',
      },
    ],
    [],
  );
  const resolvedActions = actions ?? defaultActions;
  const logoContent = (
    <>
      <Image
        source={resolvedLogoSource}
        style={isCompact ? styles.logoMobile : styles.logo}
        resizeMode='contain'
        accessibilityLabel='WhereWild logo'
      />
      {!isCompact ? <ThemedText variant='heading'>{title}</ThemedText> : null}
    </>
  );

  const {
    isControlled,
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
    enabled: showSearchResultsDropdown,
    query: controlledSearchQuery,
    onQueryChange: onSearchQueryChange,
    filterParams,
  });
  const previousPathnameRef = React.useRef(pathname);

  React.useLayoutEffect(() => {
    if (isControlled) {
      previousPathnameRef.current = pathname;
      return;
    }

    if (previousPathnameRef.current !== pathname && searchQuery !== '') {
      setSearchQuery('');
    }

    previousPathnameRef.current = pathname;
  }, [isControlled, pathname, searchQuery, setSearchQuery]);

  const hasQuery = debouncedQuery.length > 0;
  const [activeSearchResultIndex, setActiveSearchResultIndex] =
    React.useState(-1);
  const [isSearchPreviewDismissed, setIsSearchPreviewDismissed] =
    React.useState(false);

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
    isSearchPreviewDismissed,
  });

  const { isMenuOpen, menuAnchor, toggleMenu, closeMenu } =
    useWebPageHeaderMobileMenu({
      isCompact,
      menuButtonRef,
      windowWidth: window.width,
    });

  const handleSelectSearchResult = React.useCallback(
    (s: SpeciesSummary) => {
      cancelSearchBlurGrace();
      const segment = toKebabCase(s.scientificName.trim());
      if (segment) {
        router.push({
          pathname: '/species/[...identifier]',
          params: { identifier: [s.taxonId.toString(), segment] },
        });
      }
    },
    [cancelSearchBlurGrace, router],
  );

  const handleSearchFocus = React.useCallback(() => {
    cancelSearchBlurGrace();
    setIsSearchPreviewDismissed(false);
    setIsSearchBarFocused(true);
  }, [cancelSearchBlurGrace, setIsSearchBarFocused]);

  const handleSearchBlur = React.useCallback(() => {
    setIsSearchBarFocused(false);
    startSearchBlurGrace();
  }, [setIsSearchBarFocused, startSearchBlurGrace]);

  React.useEffect(() => {
    setActiveSearchResultIndex(-1);
    setIsSearchPreviewDismissed(false);
  }, [searchQuery]);

  React.useEffect(() => {
    if (!searchResultsVisible || searchResults.length === 0) {
      setActiveSearchResultIndex(-1);
      return;
    }

    setActiveSearchResultIndex((currentIndex) =>
      currentIndex >= searchResults.length ? -1 : currentIndex,
    );
  }, [searchResults, searchResultsVisible]);

  const handleSearchKeyDown = React.useCallback(
    (event: SearchInputKeyDownEvent) => {
      const key = event.key ?? event.nativeEvent?.key;
      if (!key) {
        return;
      }

      if (key === 'Escape' && searchResultsVisible) {
        event.preventDefault?.();
        setActiveSearchResultIndex(-1);
        setIsSearchPreviewDismissed(true);
        return;
      }

      if (!searchResultsVisible || searchResults.length === 0) {
        return;
      }

      if (key === 'ArrowDown' || key === 'ArrowUp') {
        event.preventDefault?.();
        setActiveSearchResultIndex((currentIndex) => {
          if (currentIndex < 0) {
            return key === 'ArrowDown' ? 0 : searchResults.length - 1;
          }

          const direction = key === 'ArrowDown' ? 1 : -1;
          return (
            (currentIndex + direction + searchResults.length) %
            searchResults.length
          );
        });
        return;
      }

      if (key === 'Enter' && activeSearchResultIndex >= 0) {
        const activeResult = searchResults[activeSearchResultIndex];
        if (!activeResult) {
          return;
        }

        event.preventDefault?.();
        handleSelectSearchResult(activeResult);
      }
    },
    [
      activeSearchResultIndex,
      handleSelectSearchResult,
      searchResults,
      searchResultsVisible,
    ],
  );

  const desktopSearchResults = (
    <WebPageHeaderSearchResults
      isVisible={searchResultsVisible}
      results={searchResults}
      isLoading={searching}
      errorMessage={searchError}
      style={getSearchResultsStyle('desktop')}
      onSelectResult={handleSelectSearchResult}
      activeResultIndex={activeSearchResultIndex}
    />
  );

  return (
    <View
      style={[styles.container, style]}
      onLayout={onLayout}
      accessibilityRole='header'
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
              <RoutePressable
                href='/'
                hrefPath='/'
                style={styles.logoSectionMobile}
                accessibilityRole='link'
                accessibilityLabel={logoAccessibilityLabel}
              >
                {logoContent}
              </RoutePressable>

              <WebPageHeaderSearchRow
                variant='mobile'
                searchInputProps={searchInputProps}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onSubmitSearch={submitSearchQuery}
                searchPlaceholder={searchPlaceholder}
                onSearchFocus={handleSearchFocus}
                onSearchBlur={handleSearchBlur}
                onSearchKeyDown={handleSearchKeyDown}
                onSearchWrapperLayout={setWrapperHeight}
                desktopSearchResults={desktopSearchResults}
                showFilterButton={showFilterButton}
                onFilterPress={onFilterPress}
                filterLabel={filterLabel}
                filterButtonAccessibilityLabel={filterButtonAccessibilityLabel}
                showResetFilterButton={showResetFilterButton}
                onResetFilterPress={onResetFilterPress}
                resetFilterButtonAccessibilityLabel={
                  resetFilterButtonAccessibilityLabel
                }
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
              activeResultIndex={activeSearchResultIndex}
            />
          </>
        ) : (
          <>
            <RoutePressable
              href='/'
              hrefPath='/'
              style={styles.logoSection}
              accessibilityRole='link'
              accessibilityLabel={logoAccessibilityLabel}
            >
              {logoContent}
            </RoutePressable>

            <WebPageHeaderSearchRow
              variant='desktop'
              searchInputProps={searchInputProps}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSubmitSearch={submitSearchQuery}
              searchPlaceholder={searchPlaceholder}
              onSearchFocus={handleSearchFocus}
              onSearchBlur={handleSearchBlur}
              onSearchKeyDown={handleSearchKeyDown}
              onSearchWrapperLayout={setWrapperHeight}
              desktopSearchResults={desktopSearchResults}
              showFilterButton={showFilterButton}
              onFilterPress={onFilterPress}
              filterLabel={filterLabel}
              filterButtonAccessibilityLabel={filterButtonAccessibilityLabel}
              showResetFilterButton={showResetFilterButton}
              onResetFilterPress={onResetFilterPress}
              resetFilterButtonAccessibilityLabel={
                resetFilterButtonAccessibilityLabel
              }
            />

            <View style={styles.actionsWrapper}>
              {resolvedActions.map(
                ({
                  label,
                  icon,
                  onPress,
                  href,
                  hrefPath,
                  variant = 'subtle',
                }) => (
                  <Button
                    key={label}
                    variant={variant}
                    onPress={onPress}
                    href={href}
                    hrefPath={hrefPath}
                    iconStart={icon}
                    label={label}
                  />
                ),
              )}
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
