import { BACKEND_BASE, fetchSpeciesList, fetchRelativeRankings } from '@/data/api';
import type { SearchFilterParams } from '@/data/api';
import { SpeciesApiNormalized, SpeciesSummary } from '@/data/types';
import { mapSpeciesApiNormalizedToSummary } from '@/data/speciesSummaryMapper';
import { useOptionalSettings } from '@/context/SettingsContext';
import React from 'react';

const SEARCH_RESULT_LIMIT = 9;
const SEARCH_RESULT_OVERFETCH_MULTIPLIER = 2;
const SEARCH_BLUR_GRACE_MS = 100;
const SEARCH_DEBOUNCE_MS = 400;

let persistedHeaderSearchQuery = '';

/** Returns true when the current filters support relative-ranking search. */
const canUseRankingSearch = (filterParams?: SearchFilterParams) => {
  const ancestorTaxonId = filterParams?.ancestorTaxonId;
  return (
    typeof ancestorTaxonId === 'number'
    && Number.isFinite(ancestorTaxonId)
    && typeof filterParams?.sortVariable === 'string'
    && filterParams.sortVariable.length > 0
    && typeof filterParams?.sortMetric === 'string'
    && filterParams.sortMetric.length > 0
  );
};

/** Extracts a stable image filename from API image file variants/paths. */
const extractImageFileName = (imageFile?: string | null) => {
  if (typeof imageFile !== 'string') {
    return '';
  }

  const trimmed = imageFile.trim();
  if (!trimmed.length) {
    return '';
  }

  return trimmed
    .replace(/^images\//, '')
    .split(/[\\/]/)
    .filter(Boolean)
    .pop() ?? '';
};

/** Normalizes optional string inputs to a trimmed non-empty string, or null. */
const toNonEmptyTrimmedString = (value?: string | null) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Converts API names to display form by trimming and replacing underscores with spaces. */
const normalizeDisplayName = (value?: string | null) => {
  const trimmed = toNonEmptyTrimmedString(value);
  return trimmed ? trimmed.replace(/_/g, ' ') : null;
};

/** Formats numbers for compact card copy without unnecessary trailing zeros. */
const formatMetricNumber = (value: number) => {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return Number(value.toFixed(3)).toString();
};

/** Normalizes percentile values from either 0..1 or 0..100 into 0..100 percentage scale. */
const normalizePercentileToPercentage = (value: number) => {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = value >= 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, normalized));
};

/** Keeps unit display compact and normalized across API/unit-system variants. */
const normalizeUnitLabel = (units?: string | null) => {
  const raw = toNonEmptyTrimmedString(units);
  if (!raw) {
    return null;
  }

  const lowered = raw.toLowerCase();
  if (lowered === 'c' || lowered === 'degc' || lowered === 'celsius') {
    return 'degC';
  }
  if (lowered === 'f' || lowered === 'degf' || lowered === 'fahrenheit') {
    return 'degF';
  }
  return raw;
};

/** Builds a ranking summary string such as: "12.5 | Rank 2 of 48 | Percentile 98%". */
const buildRankedDescription = (
  entry: {
    value?: number | null;
    position?: number | null;
    percentile?: number | null;
    count?: number | null;
    sampleCount?: number | null;
  },
  totalResults?: number | null,
  units?: string | null,
) => {
  const normalizedUnits = normalizeUnitLabel(units);
  const valuePart = typeof entry.value === 'number' && Number.isFinite(entry.value)
    ? `${formatMetricNumber(entry.value)}${normalizedUnits ? ` ${normalizedUnits}` : ''}`
    : null;

  const rankPart = typeof entry.position === 'number'
    && Number.isFinite(entry.position)
    && typeof totalResults === 'number'
    && Number.isFinite(totalResults)
    && totalResults > 0
    ? `Rank ${Math.trunc(entry.position)} of ${Math.trunc(totalResults)}`
    : null;

  const percentileFromEntry = typeof entry.percentile === 'number' && Number.isFinite(entry.percentile)
    ? entry.percentile
    : null;
  const percentileFromRank = rankPart && typeof entry.position === 'number' && typeof totalResults === 'number'
    ? (1 - ((entry.position - 1) / totalResults)) * 100
    : null;
  const percentile = percentileFromEntry ?? percentileFromRank;
  const percentilePercentage = typeof percentile === 'number'
    ? normalizePercentileToPercentage(percentile)
    : null;
  const percentilePart = typeof percentilePercentage === 'number'
    ? `Percentile ${formatMetricNumber(percentilePercentage)}%`
    : null;

  const sampleValue = typeof entry.sampleCount === 'number' && Number.isFinite(entry.sampleCount)
    ? entry.sampleCount
    : (typeof entry.count === 'number' && Number.isFinite(entry.count) ? entry.count : null);
  const samplePart = typeof sampleValue === 'number'
    ? `Samples ${formatMetricNumber(sampleValue)}`
    : null;

  const parts = [valuePart, rankPart, percentilePart, samplePart].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' | ') : 'Tap to view species details';
};

/** Resolves the best image URI from direct source/url fields or image file fallback. */
const resolveImageUri = (entry: {
  imageSource?: string | null;
  imageUrl?: string | null;
  imageFile?: string | null;
}) => {
  const directImageSource = toNonEmptyTrimmedString(entry.imageSource);
  if (directImageSource) {
    return directImageSource;
  }

  const directImageUrl = toNonEmptyTrimmedString(entry.imageUrl);
  if (directImageUrl) {
    return directImageUrl;
  }

  const imageFileName = extractImageFileName(entry.imageFile);
  if (!imageFileName) {
    return null;
  }

  return `${BACKEND_BASE}/static/species_images/${encodeURIComponent(imageFileName)}`;
};

/** Maps normalized species-list entries into card-ready summaries. */
const mapSearchResultToSummary = (entry: SpeciesApiNormalized): SpeciesSummary | null =>
  mapSpeciesApiNormalizedToSummary(entry, {
    includeRawDescription: false,
    fallbackDescription: '',
  });

/** Maps relative-ranking entries into card-ready summaries with image fallback handling. */
const mapRelativeRankingToSummary = (
  entry: {
    taxonId: number | string;
    scientificName?: string | null;
    commonName?: string | null;
    value?: number | null;
    position?: number | null;
    percentile?: number | null;
    count?: number | null;
    sampleCount?: number | null;
    imageUrl?: string | null;
    imageFile?: string | null;
    imageSource?: string | null;
  },
  totalResults?: number | null,
  units?: string | null,
): SpeciesSummary | null => {
  const taxonId = typeof entry.taxonId === 'number' ? entry.taxonId : Number(entry.taxonId);
  if (!Number.isFinite(taxonId)) {
    return null;
  }

  const scientificName = normalizeDisplayName(entry.scientificName) ?? `Taxon #${taxonId}`;
  const commonName = normalizeDisplayName(entry.commonName) ?? scientificName;
  const description = buildRankedDescription(entry, totalResults, units);

  const imageUri = resolveImageUri(entry);

  return {
    taxonId,
    commonName,
    commonNames: [commonName],
    scientificName,
    description,
    imageSource: imageUri ? { uri: imageUri } : undefined,
  };
};

type UseWebPageHeaderSearchOptions = {
  enabled?: boolean;
  initialQuery?: string;
  filterParams?: SearchFilterParams;
  onSearchingChanged?: (searching: boolean) => void;
  onSearchResultsChanged?: (results: SpeciesSummary[]) => void;
  onSearchContextChanged?: (message: string | null) => void;
};

/**
 * Manages WebPageHeader search query lifecycle:
 * initial value syncing, debounce, loading/error states, API fetch, and blur grace timing.
 */
export function useWebPageHeaderSearch({
  enabled = true,
  initialQuery,
  filterParams,
  onSearchingChanged,
  onSearchResultsChanged,
  onSearchContextChanged,
}: UseWebPageHeaderSearchOptions) {
  // Root runtime is wrapped by SettingsProvider, but some isolated renders/tests bypass
  // app/_layout. Optional settings keeps unit-aware ranking labels without hard crashes.
  const settings = useOptionalSettings();
  const units = settings?.units;
  const [searchQuery, setSearchQuery] = React.useState(() =>
    typeof initialQuery === 'string' ? initialQuery : persistedHeaderSearchQuery,
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
    if (!enabled) {
      return;
    }

    if (initialQuery === previousInitialQueryRef.current) {
      return;
    }

    previousInitialQueryRef.current = initialQuery;
    if (typeof initialQuery === 'string') {
      setSearchQuery(initialQuery);
    }
  }, [enabled, initialQuery]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    persistedHeaderSearchQuery = searchQuery;
  }, [enabled, searchQuery]);

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

  React.useEffect(() => {
    return () => {
      if (searchBlurGraceTimerRef.current) {
        clearTimeout(searchBlurGraceTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const handle = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [enabled, searchQuery]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    let cancelled = false;

    const canUseRelativeRankings = canUseRankingSearch(filterParams);
    const ancestorTaxonId = filterParams?.ancestorTaxonId;

    // Keep the page empty only when there is no query and no ranking-capable filter state.
    if (!debouncedQuery && !canUseRelativeRankings) {
      setSearchResults([]);
      onSearchResultsChanged?.([]);
      setSearchError(null);
      onSearchContextChanged?.(null);
      setSearching(false);
      onSearchingChanged?.(false);

      return;
    }

    setSearching(true);
    onSearchingChanged?.(true);
    setSearchError(null);
    onSearchContextChanged?.(null);

    (async () => {
      try {
        const sliceLimit = filterParams?.numberOfResults ?? SEARCH_RESULT_LIMIT;

        let mapped: SpeciesSummary[];

        if (canUseRelativeRankings && filterParams && ancestorTaxonId != null) {
          const rankingPayload = await fetchRelativeRankings({
            taxonId: ancestorTaxonId,
            rank: (filterParams.rank || 'species').toUpperCase(),
            variableId: filterParams.sortVariable!,
            metric: filterParams.sortMetric!,
            units,
            limit: sliceLimit,
            order: filterParams.sortOrder || 'asc',
            minSamples: filterParams.minimumSamples ?? 0,
            includeSpeciesLike: Boolean(filterParams.includeSubspecies),
            location: filterParams.locationGid ?? null,
          });

          if (cancelled) {
            return;
          }

          const loweredQuery = debouncedQuery.toLowerCase();
          // Ranking results can be filter-driven even without free-text search.
          const shouldFilterByQuery = loweredQuery.length > 0;
          mapped = rankingPayload.entries
            .map((entry) => mapRelativeRankingToSummary(
              entry,
              rankingPayload.total,
              rankingPayload.units,
            ))
            .filter((result): result is SpeciesSummary => Boolean(result))
            .filter((result) => {
              if (!shouldFilterByQuery) {
                return true;
              }
              const scientific = result.scientificName.toLowerCase();
              const common = result.commonName.toLowerCase();
              return scientific.includes(loweredQuery) || common.includes(loweredQuery);
            })
            .slice(0, sliceLimit);

          if (mapped.length === 0 && shouldFilterByQuery) {
            const fallbackFilters: SearchFilterParams = {
              locationGid: filterParams.locationGid ?? null,
              ancestorTaxonId: filterParams.ancestorTaxonId ?? null,
              rank: filterParams.rank ?? null,
              includeSubspecies: filterParams.includeSubspecies ?? true,
              sortVariable: null,
              sortMetric: null,
              sortOrder: null,
              minimumSamples: null,
              numberOfResults: sliceLimit,
            };

            const fallbackPayload = await fetchSpeciesList(sliceLimit, debouncedQuery, fallbackFilters);

            if (cancelled) {
              return;
            }

            mapped = fallbackPayload
              .map(mapSearchResultToSummary)
              .filter((result): result is SpeciesSummary => Boolean(result))
              .slice(0, sliceLimit);

            onSearchContextChanged?.(
              `No ranked matches found for "${debouncedQuery}". Showing text-search fallback results, which may include broader matches than the selected base taxon.`,
            );
          }
        } else {
          // Fallback search endpoint with query; forwards filters for backends that support them.
          const defaultLimit = filterParams?.numberOfResults
            ? undefined
            : SEARCH_RESULT_LIMIT * SEARCH_RESULT_OVERFETCH_MULTIPLIER;
          const speciesListFilters = filterParams;
          const payload = await fetchSpeciesList(defaultLimit, debouncedQuery, speciesListFilters);

          if (cancelled) {
            return;
          }

          mapped = payload
            .map(mapSearchResultToSummary)
            .filter((result): result is SpeciesSummary => Boolean(result))
            .slice(0, sliceLimit);
        }

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
        onSearchContextChanged?.(
          message === 'Search failed' ? 'Search failed. Please try again.' : `Search failed: ${message}`,
        );
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
  }, [
    enabled,
    debouncedQuery,
    filterParams,
    units,
    onSearchResultsChanged,
    onSearchContextChanged,
    onSearchingChanged,
  ]);

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
