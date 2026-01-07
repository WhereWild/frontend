import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { fetchLocations } from '@/data/api';
import type { LocationSearchResult } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from '../text/ThemedText';

export type SpeciesLocationPickerProps = {
  value?: LocationSearchResult | null;
  onChange?: (value: LocationSearchResult | null) => void;
};

const MIN_QUERY_LENGTH = 2;

export function SpeciesLocationPicker({
  value,
  onChange,
}: SpeciesLocationPickerProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [query, setQuery] = React.useState(value?.name ?? '');
  const [focused, setFocused] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<LocationSearchResult[]>([]);
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setQuery(value?.name ?? '');
  }, [value?.gid]);

  React.useEffect(() => {
    if (!focused || query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      fetchLocations(query.trim(), 8)
        .then((matches) => {
          if (cancelled) {
            return;
          }
          setResults(matches);
          setError(null);
        })
        .catch((err) => {
          if (cancelled) {
            return;
          }
          setResults([]);
          setError(err instanceof Error ? err.message : 'Failed to search locations.');
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [focused, query]);

  const cancelPendingBlur = React.useCallback(() => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }, []);

  const handleSelect = React.useCallback(
    (option: LocationSearchResult | null) => {
      cancelPendingBlur();
      onChange?.(option);
      setFocused(false);
      if (option) {
        setQuery(option.name);
      }
      setResults([]);
    },
    [cancelPendingBlur, onChange],
  );

  const selectionContext = value?.hierarchy?.length
    ? value.hierarchy.join(' • ')
    : null;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.secondary },
      ]}
    >
      <View style={styles.headerRow}>
        <ThemedText variant="heading">Filter by location</ThemedText>
        {value ? (
          <Pressable onPress={() => handleSelect(null)}>
            <ThemedText variant="bodySmallEmphasis">Clear</ThemedText>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        value={query}
        placeholder="Search countries, regions, or GBIF areas"
        placeholderTextColor={palette.text.default.secondary}
        onChangeText={setQuery}
        style={[
          styles.input,
          {
            backgroundColor: palette.background.default.tertiary,
            color: palette.text.default.primary,
          },
        ]}
        onFocus={() => {
          cancelPendingBlur();
          setFocused(true);
        }}
        onBlur={() => {
          blurTimeoutRef.current = setTimeout(() => {
            setFocused(false);
            setResults([]);
          }, 150);
        }}
      />
      <View style={styles.captionRow}>
        <ThemedText variant="bodySmall" style={{ color: palette.text.default.secondary }}>
          {value
            ? selectionContext
              ? `${value.name} • ${selectionContext}`
              : value.name
            : 'Showing global observations'}
        </ThemedText>
      </View>
      {focused ? (
        <View style={styles.resultsWrapper}>
          {loading ? (
            <View style={styles.feedbackRow}>
              <ActivityIndicator color={palette.text.brand.default} />
              <ThemedText variant="bodySmall">Searching locations…</ThemedText>
            </View>
          ) : null}
          {error ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.danger.default }}>
              {error}
            </ThemedText>
          ) : null}
          {!loading && !error && results.length === 0 && query.trim().length >= MIN_QUERY_LENGTH ? (
            <ThemedText variant="bodySmall" style={{ color: palette.text.default.secondary }}>
              No matching locations.
            </ThemedText>
          ) : null}
          {results.map((option) => {
            const hierarchy =
              option.hierarchy && option.hierarchy.length
                ? option.hierarchy.join(' • ')
                : null;
            return (
              <Pressable
                key={option.gid}
                onPress={() => handleSelect(option)}
                style={[
                  styles.resultRow,
                  { borderBottomColor: palette.border.default },
                ]}
              >
                <ThemedText variant="bodyStrong">{option.name}</ThemedText>
                {hierarchy ? (
                  <ThemedText
                    variant="bodySmall"
                    style={{ color: palette.text.default.secondary }}
                  >
                    {hierarchy}
                  </ThemedText>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: Size.radius['300'],
    padding: Size.space['300'],
    gap: Size.space['200'],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    borderRadius: Size.radius['200'],
    paddingHorizontal: Size.space['300'],
    paddingVertical: Size.space['200'],
  },
  captionRow: {
    minHeight: Size.space['200'],
  },
  resultsWrapper: {
    gap: Size.space['100'],
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  resultRow: {
    paddingVertical: Size.space['150'],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Size.space['50'],
  },
});
