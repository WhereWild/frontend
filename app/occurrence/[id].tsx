// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PageSurface, ThemedText } from '@/components';
import { Colors } from '@/constants/theme';
import { fetchOccurrenceLookup } from '@/data/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import { buildSpeciesPath } from '@/utils/speciesOpenGraph';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type OccurrenceRouteParams = {
  id?: string;
};

/**
 * /occurrence/{id} — given just an inat observation id, resolves which
 * species page it belongs to (GET /occurrence/{id}) and redirects there
 * with ?highlightObservation={id}, which _species.tsx reads to pin/select
 * that exact observation on the map — the same destination as clicking the
 * observation's image in the below-map gallery, just entered by id.
 */
export default function OccurrenceRedirectPage() {
  const params = useLocalSearchParams<OccurrenceRouteParams>();
  const router = useRouter();
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const catalogNumber = typeof params.id === 'string' ? params.id.trim() : '';
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!catalogNumber) {
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setNotFound(false);

    fetchOccurrenceLookup(catalogNumber)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (!result) {
          setNotFound(true);
          return;
        }
        const speciesPath = buildSpeciesPath({
          commonName: result.commonName,
          scientificName: result.scientificName,
          slug: result.slug,
          taxonId: result.taxonId,
        });
        router.replace(
          `${speciesPath}?highlightObservation=${encodeURIComponent(result.catalogNumber)}` as Href,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setNotFound(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalogNumber, router]);

  if (notFound) {
    return (
      <PageSurface testID='occurrence-not-found' style={styles.screen}>
        <View
          style={styles.content}
          accessibilityLiveRegion='polite'
          accessible
          accessibilityLabel='Observation not found'
        >
          <ThemedText variant='subheading'>Observation not found</ThemedText>
          <ThemedText
            variant='body'
            style={{ color: palette.text.default.tertiary }}
          >
            {catalogNumber
              ? `We couldn't find an observation with id "${catalogNumber}".`
              : 'No observation id was provided.'}
          </ThemedText>
        </View>
      </PageSurface>
    );
  }

  return (
    <PageSurface testID='occurrence-loading' style={styles.screen}>
      <View
        style={styles.content}
        accessibilityLiveRegion='polite'
        accessible
        accessibilityLabel='Looking up observation'
      >
        <ActivityIndicator size='large' color={palette.icon.brand.default} />
        <ThemedText variant='body'>Looking up observation...</ThemedText>
      </View>
    </PageSurface>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
});
