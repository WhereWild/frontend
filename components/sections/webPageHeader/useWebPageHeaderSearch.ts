import { fetchSpeciesList } from '@/data/api';
import { SpeciesApiNormalized, SpeciesSummary } from '@/data/types';
import React from 'react';

const SEARCH_RESULT_LIMIT = 9;
const SEARCH_RESULT_OVERFETCH_MULTIPLIER = 2;
const SEARCH_BLUR_GRACE_MS = 100;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const mapSearchResultToSummary = (entry: SpeciesApiNormalized): SpeciesSummary | null => {
  const rawId = typeof entry.taxon_id === 'number' ? entry.taxon_id : Number(entry.taxon_id);
  if (!Number.isFinite(rawId)) {
    return null;
  }

  const scientificName =
    (typeof entry.scientific_name === 'string' && entry.scientific_name.length > 0)
      ? entry.scientific_name
      : `Taxon #${rawId}`;

  const normalizeName = (value?: string) =>
    typeof value === 'string' && value.length > 0 ? value.replace(/_/g, ' ') : value;

  const commonName = normalizeName(entry.common_name) ?? scientificName;
  const raw = asRecord(entry._raw);
  const rawDescription = raw.description;
  const description =
    (typeof rawDescription === 'string' && rawDescription.length > 0)
      ? rawDescription
      : 'Tap to view species details';

  const imageSource =
    typeof entry.image_source === 'string'
      ? { uri: entry.image_source }
      : undefined;

  const normalizedScientificName = normalizeName(scientificName);

  return {
    taxonId: rawId,
    commonName,
    commonNames: [commonName],
    scientificName: normalizedScientificName ?? '',
    description,
    imageSource,
  };
};

type UseWebPageHeaderSearchOptions = {
  initialQuery?: string;
  onSearchingChanged?: (searching: boolean) => void;
  onSearchResultsChanged?: (results: SpeciesSummary[]) => void;
};

export function useWebPageHeaderSearch({
  initialQuery,
  onSearchingChanged,
  onSearchResultsChanged,
}: UseWebPageHeaderSearchOptions) {
  const [searchQuery, setSearchQuery] = React.useState(() =>
    typeof initialQuery === 'string' ? initialQuery : '',
  );
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SpeciesSummary[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [isSearchBarFocused, setIsSearchBarFocused] = React.useState(false);
  const [isSearchBlurGraceActive, setIsSearchBlurGraceActive] = React.useState(false);

  const previousInitialQueryRef = React.useRef(initialQuery);
  const searchBlurGraceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (initialQuery === previousInitialQueryRef.current) {
      return;
    }

    previousInitialQueryRef.current = initialQuery;
    setSearchQuery(typeof initialQuery === 'string' ? initialQuery : '');
  }, [initialQuery]);

  const cancelSearchBlurGrace = React.useCallback(() => {
    if (searchBlurGraceTimerRef.current) {
      clearTimeout(searchBlurGraceTimerRef.current);
      searchBlurGraceTimerRef.current = null;
    }
    setIsSearchBlurGraceActive(false);
  }, []);

  const startSearchBlurGrace = React.useCallback(() => {
    if (searchBlurGraceTimerRef.current) {
      clearTimeout(searchBlurGraceTimerRef.current);
    }
    setIsSearchBlurGraceActive(true);
    searchBlurGraceTimerRef.current = setTimeout(() => {
      setIsSearchBlurGraceActive(false);
      searchBlurGraceTimerRef.current = null;
    }, SEARCH_BLUR_GRACE_MS);
  }, []);

  React.useEffect(() => () => {
    if (searchBlurGraceTimerRef.current) {
      clearTimeout(searchBlurGraceTimerRef.current);
    }
  }, []);

  React.useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 400);

    return () => clearTimeout(handle);
  }, [searchQuery]);

  React.useEffect(() => {
    let cancelled = false;

    if (!debouncedQuery) {
      setSearchResults([]);
      onSearchResultsChanged?.([]);
      setSearchError(null);
      setSearching(false);

      return;
    }

    setSearching(true);
    onSearchingChanged?.(true);
    setSearchError(null);

    (async () => {
      try {
        // Over-fetch so filtering invalid/partial API records can still yield up to SEARCH_RESULT_LIMIT items.
        const payload = await fetchSpeciesList(
          SEARCH_RESULT_LIMIT * SEARCH_RESULT_OVERFETCH_MULTIPLIER,
          debouncedQuery,
        );
        if (cancelled) {
          return;
        }

        const mapped = payload
          .map(mapSearchResultToSummary)
          .filter((result): result is SpeciesSummary => Boolean(result))
          .slice(0, SEARCH_RESULT_LIMIT);

        setSearchResults(mapped);
        onSearchResultsChanged?.(mapped);
      } catch (err) {
        if (cancelled) {
          return;
        }

        const message = err instanceof Error ? err.message : 'Search failed';
        setSearchError(message);
        setSearchResults([]);
        onSearchResultsChanged?.([]);
      } finally {
        if (!cancelled) {
          setSearching(false);
          onSearchingChanged?.(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, onSearchResultsChanged, onSearchingChanged]);

  return {
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
  };
}
