import { SpeciesSummary } from '@/data/types';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SearchResults } from '../SearchResults';

type WebPageHeaderSearchResultsProps = {
  isVisible: boolean;
  results: SpeciesSummary[];
  isLoading: boolean;
  errorMessage: string | null;
  style: StyleProp<ViewStyle>;
  onSelectResult: (result: SpeciesSummary) => void;
};

/**
 * Thin visibility wrapper around SearchResults for WebPageHeader.
 * Centralizes empty/error messaging and keeps caller render logic small.
 */
export function WebPageHeaderSearchResults({
  isVisible,
  results,
  isLoading,
  errorMessage,
  style,
  onSelectResult,
}: WebPageHeaderSearchResultsProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <SearchResults
      results={results}
      isVisible={true}
      isLoading={isLoading}
      emptyMessage={errorMessage ?? 'No species found'}
      style={style}
      onSelectResult={onSelectResult}
      testID="header-search-results"
    />
  );
}
