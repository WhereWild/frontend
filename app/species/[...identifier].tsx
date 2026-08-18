// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  BACKEND_BASE,
  fetchSpeciesByTaxonId,
  fetchSpeciesObscured,
} from '@/data/api';
import { PageSurface, ThemedText } from '@/components';
import { Colors } from '@/constants/theme';
import { buildCommonNamesWithPrimary } from '@/data/commonNames';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesOverviewSection, SpeciesPageData } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Species from '../_species';
import { useSettings } from '@/context/SettingsContext';

const isPresent = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

type SpeciesBasics = {
  taxon_id?: string | null;
  common_name?: string;
  common_names?: (string | null)[];
  scientific_name?: string;
  image_source?: ImageSourcePropType | string | null;
  image_url?: string;
  description?: string;
  image_license?: string | null;
  image_license_url?: string | null;
  image_creator?: string | null;
  image_rights_holder?: string | null;
  image_references?: string | null;
  description_sections?: SpeciesOverviewSection[];
  heatmap?: {
    available?: boolean;
    resolved_model_id?: string | null;
    phenology_available?: boolean;
    full_available?: boolean;
  } | null;
  rank?: string | null;
  taxon_rank?: string | null;
  large_taxon?: boolean;
};

type SpeciesRouteParams = {
  identifier?: string | string[];
};

// Converts backend image variants into a React Native-friendly ImageSource.
const normalizeImageSource = (
  payload: SpeciesBasics,
): ImageSourcePropType | undefined => {
  if (payload.image_source) {
    return typeof payload.image_source === 'string'
      ? { uri: payload.image_source }
      : payload.image_source;
  }

  if (payload.image_url) {
    return { uri: payload.image_url };
  }

  return undefined;
};

// Merges backend basics with our rich demo fallback so the page renders even when
// the API only returns partial fields (overview text, hero image, etc.).
const buildSpeciesPageData = (
  payload: SpeciesBasics,
  requestedTaxonId?: string,
): SpeciesPageData => {
  const fallback = mountainBallCactusData;
  const normalizedCommonName =
    typeof payload.common_name === 'string' ? payload.common_name.trim() : '';
  const commonNames = buildCommonNamesWithPrimary(
    normalizedCommonName,
    payload.common_names,
  );
  const resolvedCommonName = commonNames[0] ?? fallback.commonName;
  // When backend responses include full sections (overview cards, nearby species, heat map snapshots, etc.),
  // replace the fallback spreads below with those payload fields so SpeciesPage renders purely dynamic data.
  const resolvedTaxonId =
    payload.taxon_id || requestedTaxonId || fallback.taxonId;
  const liveHeatmapAvailable =
    payload.heatmap?.available === true && Boolean(resolvedTaxonId);
  const resolvedModelId =
    typeof payload.heatmap?.resolved_model_id === 'string' &&
    payload.heatmap.resolved_model_id.trim().length > 0
      ? payload.heatmap.resolved_model_id.trim()
      : 'auto_gbt';
  const liveTileUrl = liveHeatmapAvailable
    ? `${BACKEND_BASE}/api/species/${resolvedTaxonId}/heatmap/tiles/{z}/{x}/{y}.png?model_id=${encodeURIComponent(resolvedModelId)}`
    : null;
  return {
    ...fallback,
    taxonId: resolvedTaxonId,
    commonName: resolvedCommonName,
    commonNames,
    scientificName: payload.scientific_name ?? fallback.scientificName,
    overview: {
      ...fallback.overview,
      description: payload.description ?? fallback.overview.description,
      sections: payload.description_sections,
      imageSource:
        normalizeImageSource(payload) ?? fallback.overview.imageSource,
      imageLicense: payload.image_license ?? fallback.overview.imageLicense,
      imageLicenseUrl:
        payload.image_license_url ?? fallback.overview.imageLicenseUrl,
      imageCreator: payload.image_creator ?? fallback.overview.imageCreator,
      imageRightsHolder:
        payload.image_rights_holder ?? fallback.overview.imageRightsHolder,
      imageReferences:
        payload.image_references ?? fallback.overview.imageReferences,
    },
    heatmap: {
      ...fallback.heatmap,
      liveAvailable: liveHeatmapAvailable,
      liveTileUrl,
      liveModelId: resolvedModelId,
      phenologyAvailable: payload.heatmap?.phenology_available === true,
      fullAvailable: payload.heatmap?.full_available === true,
    },
    taxonRank:
      typeof payload.taxon_rank === 'string'
        ? payload.taxon_rank.toUpperCase()
        : null,
    largeTaxon: payload.large_taxon === true,
  };
};

// Route params may arrive as strings or arrays; normalize to an array for easier parsing.
const toArray = (value: string | string[] | undefined): string[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (isPresent(value)) {
    return [value];
  }
  return [];
};

// COL XR taxon IDs are opaque alphanumeric strings (e.g. "6SRLS"), not
// necessarily numeric — so a digits-only check would wrongly reject them.
// Still requiring alphanumeric-only (no spaces/hyphens) keeps slug segments
// like "opuntia-fragilis" from being mistaken for the ID.
const toTaxonIdSegment = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return /^[A-Za-z0-9]+$/.test(trimmed) ? trimmed : undefined;
};

// Resolves the actual taxon ID to request (preferring path segments over query strings).
const getIdentifierFromParams = (params: SpeciesRouteParams) => {
  const fetchIdentifier = toArray(params.identifier)
    .map(toTaxonIdSegment)
    .find(Boolean);

  return {
    fetchIdentifier,
    requestedTaxonId: fetchIdentifier,
  };
};

const useSpeciesBasicsData = (
  fetchIdentifier?: string,
  units?: 'metric' | 'imperial',
) => {
  const [data, setData] = React.useState<SpeciesBasics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      if (!fetchIdentifier) {
        setLoading(false);
        console.error('Missing taxon ID in route segments.');
        return;
      }

      setLoading(true);

      try {
        const response = await fetchSpeciesByTaxonId(fetchIdentifier, {
          units,
        });
        if (!mounted) {
          return;
        }
        setData(response ?? null);
      } catch (err) {
        if (!mounted) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Failed to load species';
        console.error(`Failed to load species '${fetchIdentifier}':`, message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [fetchIdentifier, units]);

  return {
    data,
    loading,
  };
};

const useSpeciesObscuredData = (fetchIdentifier?: string) => {
  const [allObscured, setAllObscured] = React.useState(false);

  React.useEffect(() => {
    setAllObscured(false);
    if (!fetchIdentifier) {
      return;
    }

    let mounted = true;
    fetchSpeciesObscured(fetchIdentifier)
      .then((result) => {
        if (mounted) setAllObscured(result.all_obscured);
      })
      .catch(() => {
        if (mounted) {
          setAllObscured(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [fetchIdentifier]);

  return allObscured;
};

export default function SpeciesBasicsPage() {
  const params = useLocalSearchParams<SpeciesRouteParams>();
  const { fetchIdentifier, requestedTaxonId } = getIdentifierFromParams(params);
  const { units } = useSettings();
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const { data, loading } = useSpeciesBasicsData(fetchIdentifier, units);
  const allObscured = useSpeciesObscuredData(fetchIdentifier);

  if (loading && !data) {
    return (
      <PageSurface testID='species-page-loading' style={styles.loadingScreen}>
        <View
          style={styles.loadingContent}
          accessibilityLiveRegion='polite'
          accessible
          accessibilityLabel='Loading species data'
        >
          <ActivityIndicator size='large' color={palette.icon.brand.default} />
          <ThemedText variant='body'>Loading species...</ThemedText>
        </View>
      </PageSurface>
    );
  }

  const resolvedPageData = data
    ? { ...buildSpeciesPageData(data, requestedTaxonId), allObscured }
    : mountainBallCactusData;

  return <Species data={resolvedPageData} />;
}

export const __SPECIES_BASICS_TESTING__ = {
  normalizeImageSource,
  buildSpeciesPageData,
  getIdentifierFromParams,
  useSpeciesBasicsData,
};

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
  },
  loadingContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
});
