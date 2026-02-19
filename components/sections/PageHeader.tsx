import {
  IconFilter,
  IconHelpCircle,
  IconInfo,
  IconMenu,
  IconSettings,
} from '@/assets/icons';
import { Colors, Shadows, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { IconButton } from '../buttons/IconButton';
import type { ButtonProps } from '../buttons/Button';
import { SearchInput, type SearchInputProps } from '../inputs/SearchInput';
import { SearchResults } from './SearchResults';
import { ThemedText } from '../text/ThemedText';
import { Portal } from '../Portal';
import { fetchSpeciesList } from '@/data/api';
import { SpeciesSummary } from '@/data/types';
import { toKebabCase } from '@/utils/string';

// Allows callers to forward styling/behavior props to SearchInput while keeping PageHeader in control of its value.
type SearchInputPassthroughProps = Partial<
  Omit<SearchInputProps, 'value' | 'onQueryChange' | 'onSubmitSearch' | 'placeholder'>
>;

const mapSearchResultToSummary = (entry: any): SpeciesSummary | null => {
  const rawId = typeof entry?.taxon_id === 'number' ? entry?.taxon_id : Number(entry?.taxon_id ?? NaN);
  if (!Number.isFinite(rawId)) {
    return null;
  }
  const scientificName =
    (typeof entry?.scientific_name === 'string' && entry.scientific_name.length > 0)
      ? entry.scientific_name
      : `Taxon #${rawId}`;
  const normalizeName = (value?: string) =>
    typeof value === 'string' && value.length > 0 ? value.replace(/_/g, ' ') : value;
  const commonName = normalizeName(entry?.common_name) ?? scientificName;
  const description =
    (typeof entry?.description === 'string' && entry.description.length > 0)
      ? entry.description
      : (typeof entry?._raw?.description === 'string' && entry._raw.description.length > 0)
        ? entry._raw.description
        : 'Tap to view species details';
  const imageSource =
    typeof entry?.image_source === 'string'
      ? { uri: entry.image_source }
      : entry?.image_source;

  return {
    taxonId: rawId,
    commonName,
    commonNames: [commonName],
    scientificName: normalizeName(scientificName) ?? "",
    description,
    imageSource,
  };
};

export type PageHeaderAction = {
  label: string;
  icon: ButtonProps['iconStart'];
  onPress?: () => void;
  variant?: 'neutral' | 'subtle';
};

export type PageHeaderProps = {
  title?: string;
  logoSource?: ImageSourcePropType;
  logoAccessibilityLabel?: string;
  searchPlaceholder?: string;
  searchInputProps?: SearchInputPassthroughProps;
  actions?: PageHeaderAction[];
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
const SEARCH_RESULT_LIMIT = 9;

export function PageHeader({
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
}: PageHeaderProps) {
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

  const submitSearchQuery = (query: string) => {
    if (query !== '') {
      router.push({ pathname: '/search', params: { query: query } });
    }
  };
  const defaultActions = React.useMemo<PageHeaderAction[]>(
    () => [
      { label: 'Help', icon: <IconHelpCircle /> },
      { label: 'About', icon: <IconInfo />, onPress: navigateToAbout },
      { label: 'Settings', icon: <IconSettings /> },
    ],
    [navigateToAbout],
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

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpeciesSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [wrapperHeight, setWrapperHeight] = useState<number | null>(null);
  const [isSearchBarFocused, setIsSearchBarFocused] = useState(false);
  const [isSearchResultsHovered, setIsSearchResultsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!isCompact && isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [isCompact, isMenuOpen]);

  const measureMenuAnchor = React.useCallback(() => {
    if (!menuButtonRef.current) {
      return;
    }
    menuButtonRef.current.measureInWindow((x, y, width, height) => {
      const right = Math.max(0, window.width - (x + width));
      setMenuAnchor({ top: y + height + Size.space['200'], right });
    });
  }, [window.width]);

  useEffect(() => {
    if (isMenuOpen && isCompact) {
      measureMenuAnchor();
    }
  }, [isMenuOpen, isCompact, measureMenuAnchor]);

  if (typeof initialQuery === 'string' && initialQuery !== '' && searchQuery === '') {
    // Initialize search query from prop on first render
    // After first render, initialQuery will be set to a blank string and searchQuery will be controlled internally
    setSearchQuery(initialQuery);
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    if (!debouncedQuery) {
      setSearchResults([]);
      if (onSearchResultsChanged) {
        onSearchResultsChanged([]);
      }
      setSearchError(null);
      setSearching(false);
      return () => {
        cancelled = true;
      };
    }

    setSearching(true);
    if (onSearchingChanged) {
      onSearchingChanged(true);
    }
    setSearchError(null);
    (async () => {
      try {
        const payload = await fetchSpeciesList(SEARCH_RESULT_LIMIT * 2, debouncedQuery);
        if (cancelled) {
          return;
        }
        const mapped = payload
          .map(mapSearchResultToSummary)
          .filter((entry: any): entry is SpeciesSummary => Boolean(entry))
          .slice(0, SEARCH_RESULT_LIMIT);
        setSearchResults(mapped);
        if (onSearchResultsChanged) {
          onSearchResultsChanged(mapped);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Search failed';
        setSearchError(message);
        setSearchResults([]);
        if (onSearchResultsChanged) {
          onSearchResultsChanged([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
          if (onSearchingChanged) {
            onSearchingChanged(false);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, onSearchResultsChanged, onSearchingChanged]);

  const hasQuery = debouncedQuery.length > 0;

  const searchResultsVisible =
    wrapperHeight &&
    hasQuery &&
    showSearchResultsDropdown &&
    (isCompact || isSearchBarFocused || isSearchResultsHovered);
  const searchResultsTop = wrapperHeight ? wrapperHeight + Size.space['200'] : undefined;

  const renderSearchResults = () =>
    searchResultsVisible ? (
      <SearchResults
        results={searchResults}
        isVisible={true}
        isLoading={searching}
        emptyMessage={searchError ?? 'No species found'}
        style={searchResultsTop ? { top: searchResultsTop } : undefined}
        onPointerEnter={() => setIsSearchResultsHovered(true)}
        onPointerLeave={() => setIsSearchResultsHovered(false)}
        onTouchStart={() => setIsSearchResultsHovered(true)}
        onTouchEnd={() => setIsSearchResultsHovered(false)}
        onSelectResult={(s) => {
          const segment = toKebabCase((s.scientificName ?? '').trim());
          if (segment) {
            router.push(`/species/${s.taxonId}/${segment}` as any);
          }
        }}
        testID="header-search-results"
      />
    ) : null;

  const renderSearchContent = (variant: 'mobile' | 'desktop') => (
    <View
      onFocus={() => setIsSearchBarFocused(true)}
      onBlur={() => setIsSearchBarFocused(false)}
      style={[
        styles.searchRow,
        variant === 'mobile' ? styles.searchRowMobile : styles.searchRowDesktop,
      ]}
      testID="page-header-search-row"
    >
      <View
        style={styles.searchWrapper}
        onLayout={(e) => {
          setWrapperHeight(e.nativeEvent.layout.height);
        }}
        testID="page-header-search-wrapper"
      >
        <SearchInput
          value={searchQuery}
          onQueryChange={setSearchQuery}
          onSubmitSearch={submitSearchQuery}
          placeholder={searchPlaceholder}
          {...searchInputProps}
        />

        {renderSearchResults()}
      </View>

      {showFilterButton ? (
        variant === 'mobile' ? (
          <IconButton
            variant="neutral"
            icon={<IconFilter />}
            onPress={onFilterPress}
            accessibilityLabel={filterButtonAccessibilityLabel}
          />
        ) : (
          <Button
            variant="neutral"
            iconStart={<IconFilter />}
            label={filterLabel}
            onPress={onFilterPress}
            accessibilityLabel={filterButtonAccessibilityLabel}
          />
        )
      ) : null}

      {variant === 'mobile' ? (
        <View ref={menuButtonRef} collapsable={false}>
          <IconButton
            variant="primary"
            icon={<IconMenu />}
            onPress={() => {
              if (isMenuOpen) {
                setIsMenuOpen(false);
                return;
              }
              measureMenuAnchor();
              setIsMenuOpen(true);
            }}
            accessibilityLabel="Open menu"
          />
        </View>
      ) : null}
    </View>
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
          <View style={styles.mobileHeaderRow}>
            <Pressable
              onPress={navigateHome}
              style={styles.logoSectionMobile}
              accessibilityRole="link"
              accessibilityLabel={logoAccessibilityLabel}
            >
              {logoContent}
            </Pressable>

            {renderSearchContent('mobile')}
          </View>

          {isMenuOpen ? (
            <Portal visible={isMenuOpen} onDismiss={() => setIsMenuOpen(false)}>
              <Pressable
                testID="page-header-menu-backdrop"
                style={styles.menuBackdrop}
                onPress={() => setIsMenuOpen(false)}
              />
              <View
                style={[
                  styles.mobileMenu,
                  {
                    backgroundColor: palette.background.default.tertiary,
                    borderColor: palette.border.default.tertiary,
                  },
                  menuAnchor
                    ? { top: menuAnchor.top + Size.space['600'], right: menuAnchor.right }
                    : { top: insets.top + Size.space['1600'] + Size.space['300'], right: Size.space['200'] },
                  Shadows.dropShadow400.style,
                ]}
              >
                {resolvedActions.map(({ label, icon, onPress, variant = 'subtle' }) => (
                  <Button
                    key={label}
                    variant={variant}
                    onPress={onPress}
                    iconStart={icon}
                    label={label}
                    style={styles.mobileMenuButton}
                  />
                ))}
              </View>
            </Portal>
          ) : null}
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

          {renderSearchContent('desktop')}

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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['400'],
  },
  searchRowDesktop: {
    flex: 1,
    minWidth: Size.space['8000'],
  },
  searchRowMobile: {
    flex: 1,
    gap: Size.space['200'],
  },
  searchWrapper: {
    flex: 1,
    position: 'relative',
  },
  actionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  mobileMenu: {
    position: 'absolute',
    padding: Size.space['200'],
    gap: Size.space['200'],
    borderRadius: Size.radius['400'],
    borderWidth: Size.stroke.border,
    zIndex: 10000,
  },
  mobileMenuButton: {
    width: '100%',
  },
});
