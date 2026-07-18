// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SearchTaxaQueryFilters } from '@/data/api';
import { useTaxaQuerySearch } from './useTaxaQuerySearch';
import { useEffect, useState } from 'react';

type UseSearchControllerParams = {
  filterParams: SearchTaxaQueryFilters;
  nativeInitialQuery?: string;
  isNative: boolean;
  isWeb: boolean;
  searchEnabled: boolean;
  searchQuery: string;
};

export function useSearchController({
  filterParams,
  nativeInitialQuery,
  isNative,
  isWeb,
  searchEnabled,
  searchQuery,
}: UseSearchControllerParams) {
  const [nativeSearchQuery, setNativeSearchQuery] = useState(
    nativeInitialQuery ?? '',
  );

  useEffect(() => {
    if (!isNative) {
      return;
    }

    setNativeSearchQuery(nativeInitialQuery ?? '');
  }, [isNative, nativeInitialQuery]);

  const resolvedSearchQuery = isNative ? nativeSearchQuery : searchQuery;
  const { searchContext, searchResults, searchTotal, searching } =
    useTaxaQuerySearch({
      enabled: searchEnabled && (isNative || isWeb),
      query: resolvedSearchQuery,
      filterParams,
    });

  return {
    nativeSearchQuery,
    setNativeSearchQuery,
    searchContext,
    searchResults,
    searchTotal,
    searching,
  };
}
