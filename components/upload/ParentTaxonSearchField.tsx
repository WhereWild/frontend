// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ThemedText } from '@/components';
import { SearchInput } from '@/components/inputs/SearchInput';
import { SearchResults } from '@/components/lists/SearchResults';
import { Size, type Colors } from '@/constants/theme';
import { fetchTaxaQuery } from '@/data/api';
import { mapSpeciesApiNormalizedToSummary } from '@/data/speciesSummaryMapper';
import type { SpeciesSummary } from '@/data/types';

export type ParentTaxonSelection = {
  taxonId: string;
  label: string;
};

// Mirrors hooks/search/filters/useSearchFilters.helpers.ts's own constants --
// same debounce/result-count/blur-grace conventions, and the same
// SearchResults/SpeciesCard result list, as the "Scope taxon" search on the
// filters page (components/sections/Filters.tsx), so a taxon search looks
// and behaves identically everywhere in the app.
const SUGGESTION_DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 5;
const BLUR_GRACE_MS = 140;

type ParentTaxonSearchFieldProps = {
  value: ParentTaxonSelection | null;
  onChange: (value: ParentTaxonSelection | null) => void;
  disabled?: boolean;
  palette: (typeof Colors)['light'] | (typeof Colors)['dark'];
};

export function ParentTaxonSearchField({
  value,
  onChange,
  disabled = false,
  palette,
}: ParentTaxonSearchFieldProps) {
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<SpeciesSummary[]>([]);
  const [suggestionsVisible, setSuggestionsVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearBlurTimeout = React.useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => () => clearBlurTimeout(), [clearBlurTimeout]);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetchTaxaQuery({
        q: trimmed,
        limit: SUGGESTION_LIMIT,
        offset: 0,
        minSamples: 0,
      })
        .then((response) => {
          if (!cancelled) {
            const mapped = response.results
              .map((entry) => mapSpeciesApiNormalizedToSummary(entry))
              .filter((entry): entry is SpeciesSummary => entry !== null);
            setSuggestions(mapped);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = (species: SpeciesSummary) => {
    clearBlurTimeout();
    setQuery('');
    setSuggestions([]);
    setSuggestionsVisible(false);
    onChange({
      taxonId: species.taxonId,
      label: species.commonName || species.scientificName,
    });
  };

  const handleFocus = () => {
    clearBlurTimeout();
    if (query.trim().length > 0) {
      setSuggestionsVisible(true);
    }
  };

  const handleBlur = () => {
    clearBlurTimeout();
    blurTimeoutRef.current = setTimeout(() => {
      setSuggestionsVisible(false);
    }, BLUR_GRACE_MS);
  };

  if (value) {
    return (
      <View style={styles.selectedRow}>
        <ThemedText
          variant='body'
          style={{ color: palette.text.default.default }}
        >
          {value.label}
        </ThemedText>
        <Button
          variant='subtle'
          label='Clear'
          disabled={disabled}
          onPress={() => onChange(null)}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SearchInput
        variant='secondary'
        value={query}
        placeholder='Search for a parent taxon'
        disabled={disabled}
        onQueryChange={(text) => {
          setQuery(text);
          setSuggestionsVisible(text.trim().length > 0);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <SearchResults
        results={suggestions}
        isVisible={suggestionsVisible && query.trim().length > 0}
        isLoading={loading}
        emptyMessage='No matching taxa found'
        onSelectResult={handleSelect}
        style={styles.results}
        layout='inline'
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: Size.space['100'],
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
    flexWrap: 'wrap',
  },
  results: {
    width: '100%',
  },
});
