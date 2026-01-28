import {
  IconFilter,
  IconHelpCircle,
  IconInfo,
  IconSettings,
} from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Button } from '../buttons/Button';
import type { ButtonProps } from '../buttons/Button';
import { SearchInput, type SearchInputProps } from '../inputs/SearchInput';
import { SearchResults } from '../inputs/SearchResults';
import { ThemedText } from '../text/ThemedText';
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
      router.push({pathname: '/search', params: {query: query}});
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
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="WhereWild logo"
      />
      <ThemedText
        variant="heading"
        style={{ color: palette.text.brand.default }}  // override color to match page header mock
      >
        {title}
      </ThemedText>
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background.default.secondary,
        },
        style,
      ]}
      accessibilityRole="header"
    >
      <Pressable
        onPress={navigateHome}
        style={styles.logoSection}
        accessibilityRole="link"
        accessibilityLabel={logoAccessibilityLabel}
      >
        {logoContent}
      </Pressable>

      <View 
        onFocus={() => setIsSearchBarFocused(true)}
        onBlur={() => setIsSearchBarFocused(false)}
        style={styles.searchRow}
      >
        <View
          style={styles.searchWrapper}
          onLayout={(e) => {
            setWrapperHeight(e.nativeEvent.layout.height);
          }}
        >
          <SearchInput
            value={searchQuery}
            onQueryChange={setSearchQuery}
            onSubmitSearch={submitSearchQuery}
            placeholder={searchPlaceholder}
            {...searchInputProps}
          />
        </View>

        {wrapperHeight && hasQuery && showSearchResultsDropdown && (isSearchBarFocused || isSearchResultsHovered) && (
          <View
            onPointerEnter={() => setIsSearchResultsHovered(true)}
            onPointerLeave={() => setIsSearchResultsHovered(false)}
            style={[
              styles.resultsOverlay,
              {
                top: wrapperHeight + Size.space['200'],
                width: '100%',
                maxWidth: 440,
              },
            ]}
          >
            <SearchResults
              results={searchResults}
              isVisible={true}
              isLoading={searching}
              emptyMessage={searchError ?? 'No species found'}
              onSelectResult={(s) => {
                const segment = toKebabCase((s.scientificName ?? '').trim());
                if (segment) {
                  router.push(`/species/${s.taxonId}/${segment}` as any);
                }
              }}
              testID="header-search-results"
            />
          </View>
        )}
        {showFilterButton ? (
          <Button
            variant="neutral"
            iconStart={<IconFilter />}
            label={filterLabel}
            onPress={onFilterPress}
            accessibilityLabel={filterButtonAccessibilityLabel}
          />
        ) : null}
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: Size.space['800'],
    paddingVertical: Size.space['200'],
    gap: Size.space['400'],
    zIndex: 9999,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  logo: {
    width: Size.space['1600'],
    height: Size.space['1600'],
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Size.space['400'],
    minWidth: Size.space['8000']
  },
  searchWrapper: {
    flex: 1,
  },
  resultsOverlay: {
    position: 'absolute',
    zIndex: 9999,
  },
  actionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['400'],
    flexWrap: 'wrap',
  },
});
