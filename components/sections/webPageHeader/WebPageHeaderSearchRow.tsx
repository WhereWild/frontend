import { IconFilter, IconRotateCcw } from '@/assets/icons';
import { Size } from '@/constants/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../buttons/Button';
import { IconButton } from '../../buttons/IconButton';
import { SearchInput } from '../../inputs/SearchInput';
import type { SearchInputPassthroughProps } from './types';

type SearchVariant = 'mobile' | 'desktop';

type WebPageHeaderSearchRowProps = {
  variant: SearchVariant;
  searchInputProps?: SearchInputPassthroughProps;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  onSubmitSearch: (query: string) => void;
  searchPlaceholder: string;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onSearchWrapperLayout: (height: number) => void;
  desktopSearchResults: React.ReactNode;
  showFilterButton: boolean;
  onFilterPress?: () => void;
  filterLabel: string;
  filterButtonAccessibilityLabel: string;
  showResetFilterButton: boolean;
  onResetFilterPress?: () => void;
  resetFilterButtonAccessibilityLabel: string;
};

/**
 * Header search row UI: search input + optional filter control.
 * Desktop renders results in-row; compact mode renders controls only.
 */
export function WebPageHeaderSearchRow({
  variant,
  searchInputProps,
  searchQuery,
  setSearchQuery,
  onSubmitSearch,
  searchPlaceholder,
  onSearchFocus,
  onSearchBlur,
  onSearchWrapperLayout,
  desktopSearchResults,
  showFilterButton,
  onFilterPress,
  filterLabel,
  filterButtonAccessibilityLabel,
  showResetFilterButton,
  onResetFilterPress,
  resetFilterButtonAccessibilityLabel,
}: WebPageHeaderSearchRowProps) {
  const {
    onFocus: onSearchInputFocus,
    onBlur: onSearchInputBlur,
    ...resolvedSearchInputProps
  } = searchInputProps ?? {};

  return (
    <View
      style={[
        styles.searchRow,
        variant === 'mobile' ? styles.searchRowMobile : styles.searchRowDesktop,
      ]}
      testID="page-header-search-row"
    >
      <View
        style={styles.searchWrapper}
        onLayout={(event) => {
          onSearchWrapperLayout(event.nativeEvent.layout.height);
        }}
        testID="page-header-search-wrapper"
      >
        <SearchInput
          {...resolvedSearchInputProps}
          value={searchQuery}
          onQueryChange={setSearchQuery}
          onSubmitSearch={onSubmitSearch}
          placeholder={searchPlaceholder}
          onFocus={(event) => {
            onSearchFocus();
            onSearchInputFocus?.(event);
          }}
          onBlur={(event) => {
            onSearchBlur();
            onSearchInputBlur?.(event);
          }}
        />

        {variant === 'desktop' ? desktopSearchResults : null}
      </View>

      {showFilterButton ? (
        <View
          style={[
            styles.filterControls,
            variant === 'mobile' ? styles.filterControlsMobile : styles.filterControlsDesktop,
          ]}
        >
          {showResetFilterButton ? (
            <IconButton
              variant="neutral"
              icon={<IconRotateCcw />}
              onPress={onResetFilterPress}
              accessibilityLabel={resetFilterButtonAccessibilityLabel}
            />
          ) : null}

          {variant === 'mobile' ? (
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
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    minWidth: 0,
    position: 'relative',
  },
  filterControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterControlsDesktop: {
    gap: Size.space['400'],
  },
  filterControlsMobile: {
    gap: Size.space['200'],
  },
});
