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
import { Button } from '../buttons/Button';
import { ThemedText } from '../text/ThemedText';
import { SpeciesSummary } from '@/data/types';
import { toKebabCase } from '@/utils/string';
import { useWebPageHeaderMobileMenu } from './webPageHeader/useWebPageHeaderMobileMenu';
import { useWebPageHeaderSearch } from './webPageHeader/useWebPageHeaderSearch';
import { useWebPageHeaderSearchLayout } from './webPageHeader/useWebPageHeaderSearchLayout';
import { WebPageHeaderSearchResults } from './webPageHeader/WebPageHeaderSearchResults';
import { WebPageHeaderSearchRow } from './webPageHeader/WebPageHeaderSearchRow';
import { WebPageHeaderMobileMenu } from './webPageHeader/WebPageHeaderMobileMenu';
import type { WebPageHeaderAction, SearchInputPassthroughProps } from './webPageHeader/types';

export type { WebPageHeaderAction } from './webPageHeader/types';

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
  style?: StyleProp<ViewStyle>;
  showSearchResultsDropdown?: boolean;
  initialQuery?: string;
  onSearchingChanged?: (searching: boolean) => void;
  onSearchResultsChanged?: (results: SpeciesSummary[]) => void;
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
  style,
  logoAccessibilityLabel = 'Go to home',
  showSearchResultsDropdown = true,
  initialQuery,
  onSearchingChanged,
  onSearchResultsChanged,
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

  const submitSearchQuery = (query: string) => {
    if (query !== '') {
      router.push({ pathname: '/search', params: { query } });
    }
  };
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
    onSearchingChanged,
    onSearchResultsChanged,
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
    width: Size.space['1200'],
    height: Size.space['1200'],
  },
  actionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
});
