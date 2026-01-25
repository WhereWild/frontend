import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import SpeciesPage from '../_speciesPage';
import { fetchSpeciesByTaxonId } from '@/data/api';
import type { SpeciesPageData } from '@/data/types';
import { mountainBallCactusData } from '@/data/speciesSample';

const isPresent = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

type SpeciesBasics = {
  taxon_id?: number;
  common_name?: string;
  common_names?: string[];
  scientific_name?: string;
  image_source?: ImageSourcePropType | string;
  image_url?: string;
  image_license?: string;
  image_creator?: string;
  image_rights_holder?: string;
  image_references?: string;
  description?: string;
  taxonomy_path?: string;
};

type SpeciesRouteParams = {
  identifier?: string | string[];
  taxonId?: string;
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
  const normalizeName = (value?: string) => (isPresent(value) ? value.replace(/_/g, ' ') : value);
  const normalizeNames = (value?: string[] | string) => {
    if (Array.isArray(value)) {
      return value
        .map((name) => normalizeName(name))
        .filter((name): name is string => Boolean(name));
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
        .split(',')
        .map((name) => normalizeName(name.trim()))
        .filter((name): name is string => Boolean(name));
    }
    return [];
  };
  // When backend responses include full sections (overview cards, nearby species, heat map snapshots, etc.),
  // replace the fallback spreads below with those payload fields so SpeciesPage renders purely dynamic data.
  const resolvedTaxonId = payload.taxon_id ?? requestedTaxonId ?? fallback.taxonId;
  const resolvedTaxonomyPath =
    typeof payload.taxonomy_path === 'string' && payload.taxonomy_path.length
      ? payload.taxonomy_path
      : undefined;
  const normalizedCommonNames = normalizeNames(payload.common_names ?? payload.common_name);
  return {
    ...fallback,
    taxonId: resolvedTaxonId,
    commonName: normalizeName(payload.common_name) ?? fallback.commonName,
    commonNames: normalizedCommonNames.length > 0 ? normalizedCommonNames : fallback.commonNames,
    scientificName: normalizeName(payload.scientific_name) ?? fallback.scientificName,
    taxonomyPath: resolvedTaxonomyPath ?? fallback.taxonomyPath,
    overview: {
      ...fallback.overview,
      description: payload.description ?? fallback.overview.description,
      imageSource: normalizeImageSource(payload) ?? fallback.overview.imageSource,
      imageLicense: payload.image_license,
      imageCreator: payload.image_creator,
      imageRightsHolder: payload.image_rights_holder,
      imageReferences: payload.image_references,
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
  const identifierSegments = toArray(params.identifier);
  const segmentMatch = identifierSegments
    .map(toNumericTaxonId)
    .find((segment) => typeof segment === 'string');

  const queryMatch = toNumericTaxonId(params.taxonId);
  const fetchIdentifier = segmentMatch ?? queryMatch;

  return {
    fetchIdentifier,
    requestedTaxonId: fetchIdentifier ? Number(fetchIdentifier) : undefined,
  };
};

export default function SpeciesBasicsPage() {
  const params = useLocalSearchParams<SpeciesRouteParams>();
  const identifierParam = params.identifier;
  const taxonParam = params.taxonId;

  const identifierDependencyKey = Array.isArray(identifierParam)
    ? identifierParam.join('|')
    : identifierParam ?? '';

  const { fetchIdentifier, requestedTaxonId } = React.useMemo(
    () => getIdentifierFromParams({ identifier: identifierParam, taxonId: taxonParam }),
    [identifierDependencyKey, taxonParam],
  );

  const routeParamsForLogging = React.useMemo(
    () => ({ identifier: identifierParam, taxonId: taxonParam }),
    [identifierDependencyKey, taxonParam],
  );

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
          'Missing numeric taxon ID in route parameters. Received:',
          routeParamsForLogging,
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
  }, [fetchIdentifier, routeParamsForLogging]);

  if (loading && !data) {
    return null;
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
