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
      isLoading={isLoading}
      emptyMessage={errorMessage ?? 'No species found'}
      style={style}
      onSelectResult={onSelectResult}
      testID="header-search-results"
    />
  );
}
