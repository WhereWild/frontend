// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SpeciesSummary } from '@/data/types';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { SearchResults } from '../../lists/SearchResults';

type WebPageHeaderSearchResultsProps = {
  isVisible: boolean;
  results: SpeciesSummary[];
  isLoading: boolean;
  errorMessage: string | null;
  style: StyleProp<ViewStyle>;
  onSelectResult: (result: SpeciesSummary) => void;
  activeResultIndex?: number;
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
  activeResultIndex,
}: WebPageHeaderSearchResultsProps) {
  return (
    <SearchResults
      results={results}
      isVisible={isVisible}
      isLoading={isLoading}
      emptyMessage={errorMessage ?? 'No species found'}
      style={style}
      onSelectResult={onSelectResult}
      activeResultIndex={activeResultIndex}
      testID={isVisible ? 'header-search-results' : undefined}
    />
  );
}
