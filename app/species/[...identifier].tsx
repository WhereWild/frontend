import { fetchSpeciesByTaxonId } from '@/data/api';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesPageData } from '@/data/types';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import SpeciesPage from '../_speciesPage';
import HomeScreen from '../index';

const isPresent = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

type SpeciesBasics = {
  taxon_id?: number;
  common_name?: string;
  scientific_name?: string;
  image_source?: ImageSourcePropType | string;
  image_url?: string;
  description?: string;
  heatmap_image_source?: ImageSourcePropType | string;
};

type SpeciesRouteParams = {
  identifier?: string | string[];
};

// Converts backend image variants into a React Native-friendly ImageSource.
const normalizeImageSource = (payload: SpeciesBasics): ImageSourcePropType | undefined => {
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
  requestedTaxonId?: number,
): SpeciesPageData => {
  const fallback = mountainBallCactusData;
  // When backend responses include full sections (overview cards, nearby species, heat map snapshots, etc.),
  // replace the fallback spreads below with those payload fields so SpeciesPage renders purely dynamic data.
  const resolvedTaxonId = payload.taxon_id ?? requestedTaxonId ?? fallback.taxonId;
  const heatmapSource =
  normalizeImageSource({ image_source: payload.heatmap_image_source ?? payload.heatmap_image_source }) ??
  fallback.heatmap.imageSource;
  return {
    ...fallback,
    taxonId: resolvedTaxonId,
    commonName: payload.common_name ?? fallback.commonName,
    scientificName: payload.scientific_name ?? fallback.scientificName,
    overview: {
      ...fallback.overview,
      description: payload.description ?? fallback.overview.description,
      imageSource: normalizeImageSource(payload) ?? fallback.overview.imageSource,
    },
    heatmap: {
      ...fallback.heatmap,
      imageSource: heatmapSource,
    },
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

// Pads out numeric validation so we never pass slugs or text to the backend fetch.
const toNumericTaxonId = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? trimmed : undefined;
};

// Resolves the actual taxon ID to request (preferring path segments over query strings).
const getIdentifierFromParams = (params: SpeciesRouteParams) => {
  const fetchIdentifier = toArray(params.identifier)
    .map(toNumericTaxonId)
    .find(Boolean);

  return {
    fetchIdentifier,
    requestedTaxonId: fetchIdentifier ? Number(fetchIdentifier) : undefined,
  };
};

export default function SpeciesBasicsPage() {
  const params = useLocalSearchParams<SpeciesRouteParams>();
  const { fetchIdentifier, requestedTaxonId } = getIdentifierFromParams(params);

  const [data, setData] = React.useState<SpeciesBasics | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Fetch the selected species whenever the resolved numeric identifier changes.
  // The mounted flag ensures we never update state after the component unmounts.
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      if (!fetchIdentifier) {
        setLoading(false);
        console.error(
          'Missing numeric taxon ID in route segments.',
        );
        return;
      }

      setLoading(true);

      try {
        const response = await fetchSpeciesByTaxonId(fetchIdentifier);
        if (!mounted) {
          return;
        }
        setData(response ?? null);
      } catch (err) {
        if (!mounted) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to load species';
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
  }, [fetchIdentifier]);

  if (loading && !data) {
    return <HomeScreen/>;
  }

  const resolvedPageData = data
    ? buildSpeciesPageData(data, requestedTaxonId)
    : mountainBallCactusData;

  return <SpeciesPage data={resolvedPageData} />;
}

export const __SPECIES_BASICS_TESTING__ = {
  normalizeImageSource,
  buildSpeciesPageData,
  getIdentifierFromParams,
};
