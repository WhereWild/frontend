import { BACKEND_BASE, fetchSpeciesByTaxonId } from '@/data/api';
import { buildCommonNamesWithPrimary } from '@/data/commonNames';
import { mountainBallCactusData } from '@/data/speciesSample';
import type { SpeciesOverviewSection, SpeciesPageData } from '@/data/types';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import Species from '../_species';
import { useSettings } from '@/context/SettingsContext';

const isPresent = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

type SpeciesBasics = {
  taxon_id?: number | null;
  common_name?: string;
  common_names?: (string | null)[];
  scientific_name?: string;
  image_source?: ImageSourcePropType | string | null;
  image_url?: string;
  description?: string;
  image_license?: string | null;
  image_creator?: string | null;
  image_rights_holder?: string | null;
  image_references?: string | null;
  description_sections?: SpeciesOverviewSection[];
  heatmap?: {
    available?: boolean;
    resolved_model_id?: string | null;
    phenology_available?: boolean;
  } | null;
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
  const normalizedCommonName =
    typeof payload.common_name === 'string' ? payload.common_name.trim() : '';
  const commonNames = buildCommonNamesWithPrimary(normalizedCommonName, payload.common_names);
  const resolvedCommonName = commonNames[0] ?? fallback.commonName;
  // When backend responses include full sections (overview cards, nearby species, heat map snapshots, etc.),
  // replace the fallback spreads below with those payload fields so SpeciesPage renders purely dynamic data.
  const resolvedTaxonId = payload.taxon_id ?? requestedTaxonId ?? fallback.taxonId;
  const liveHeatmapAvailable = payload.heatmap?.available === true && resolvedTaxonId > 0;
  const resolvedModelId =
    typeof payload.heatmap?.resolved_model_id === 'string' && payload.heatmap.resolved_model_id.trim().length > 0
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
      imageSource: normalizeImageSource(payload) ?? fallback.overview.imageSource,
      imageLicense: payload.image_license ?? fallback.overview.imageLicense,
      imageCreator: payload.image_creator ?? fallback.overview.imageCreator,
      imageRightsHolder: payload.image_rights_holder ?? fallback.overview.imageRightsHolder,
      imageReferences: payload.image_references ?? fallback.overview.imageReferences,
    },
    heatmap: {
      ...fallback.heatmap,
      liveAvailable: liveHeatmapAvailable,
      liveTileUrl,
      liveModelId: resolvedModelId,
      phenologyAvailable: payload.heatmap?.phenology_available === true,
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

const useSpeciesBasicsData = (fetchIdentifier?: string, units?: 'metric' | 'imperial') => {
  const [data, setData] = React.useState<SpeciesBasics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      if (!fetchIdentifier) {
        setLoading(false);
        console.error('Missing numeric taxon ID in route segments.');
        return;
      }

      setLoading(true);

      try {
        const response = await fetchSpeciesByTaxonId(fetchIdentifier, { units });
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
  }, [fetchIdentifier, units]);

  return {
    data,
    loading,
  };
};

export default function SpeciesBasicsPage() {
  const params = useLocalSearchParams<SpeciesRouteParams>();
  const { fetchIdentifier, requestedTaxonId } = getIdentifierFromParams(params);
  const { units } = useSettings();

  const { data, loading } = useSpeciesBasicsData(fetchIdentifier, units);

  if (loading && !data) {
    return null;
  }

  const resolvedPageData = data
    ? buildSpeciesPageData(data, requestedTaxonId)
    : mountainBallCactusData;

  return <Species data={resolvedPageData} />;
}

export const __SPECIES_BASICS_TESTING__ = {
  normalizeImageSource,
  buildSpeciesPageData,
  getIdentifierFromParams,
  useSpeciesBasicsData,
};
