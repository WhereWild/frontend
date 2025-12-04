import { fetchSpeciesByTaxonId, fetchSpeciesEnvironment } from '@/data/api';
import { mountainBallCactusData } from '@/data/speciesSample';
import type {
  EnvironmentalDataDetail,
  EnvironmentalDataEntry,
  EnvironmentalDataSection,
  SpeciesEnvironmentStats,
  SpeciesPageData,
} from '@/data/types';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import type { ImageSourcePropType } from 'react-native';
import SpeciesPage from '../_speciesPage';

const isPresent = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

type SpeciesBasics = {
  taxon_id?: number;
  common_name?: string;
  scientific_name?: string;
  image_source?: ImageSourcePropType | string;
  image_url?: string;
  description?: string;
  _raw?: Record<string, unknown>;
};

type SpeciesRouteParams = {
  identifier?: string | string[];
};

const ENVIRONMENT_SECTION_TITLE = 'Environmental Factors';

const ENVIRONMENT_VARIABLE_TARGETS = [
  { variableId: 'elevation', fallbackLabel: 'Elevation distribution' },
  { variableId: 'annual_precip', fallbackLabel: 'Annual precipitation' },
  { variableId: 'mean_temp_coldest_quarter', fallbackLabel: 'Mean temp (coldest quarter)' },
  { variableId: 'max_temp_warmest_month', fallbackLabel: 'Max temp (warmest month)' },
] as const;

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
  const resolvedTaxonId = payload.taxon_id ?? requestedTaxonId ?? fallback.taxonId;
  const resolvedImage = normalizeImageSource(payload) ?? fallback.overview?.imageSource;
  const description = payload.description ?? '';

  return {
    taxonId: resolvedTaxonId,
    commonName: payload.common_name ?? `Taxon ${resolvedTaxonId}`,
    scientificName: payload.scientific_name ?? `Taxon ${resolvedTaxonId}`,
    description,
    imageSource: resolvedImage,
    overview: {description, imageSource: resolvedImage},
    dataSections: [],
    nearbySpecies: [],
    heatmap: {},
  };
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const formatMeasurement = (value: number | null | undefined, units?: string | null) => {
  if (!isFiniteNumber(value)) {
    return null;
  }
  const fractionDigits = Math.abs(value) >= 100 ? 0 : 1;
  const formatted = value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
  return units ? `${formatted} ${units}` : formatted;
};

const formatSamples = (count: number | null | undefined) => {
  if (!isFiniteNumber(count)) {
    return '0';
  }
  return Math.max(0, Math.round(count)).toLocaleString();
};

const formatPercent = (fraction: number | null | undefined) => {
  if (!isFiniteNumber(fraction)) {
    return '0%';
  }
  return `${(fraction * 100).toFixed(1)}%`;
};

const buildEnvironmentDetails = (
  stats: SpeciesEnvironmentStats,
): EnvironmentalDataDetail[] => {
  const summary = stats.summary;
  const units = stats.units;
  const details: EnvironmentalDataDetail[] = [];

  details.push({ label: 'Samples', value: formatSamples(summary.count) });

  const mean = formatMeasurement(summary.mean, units);
  if (mean) {
    details.push({ label: 'Mean', value: mean });
  }

  const stddev = formatMeasurement(summary.stddev, units);
  if (stddev) {
    details.push({ label: 'Std dev', value: stddev });
  }

  const q10 = formatMeasurement(summary.q10, units);
  const q90 = formatMeasurement(summary.q90, units);
  if (q10 && q90) {
    details.push({ label: 'Central range', value: `${q10} to ${q90}` });
  }

  const categoricalSource = stats.dominantCategories?.length
    ? stats.dominantCategories
    : stats.categoricalDistribution;

  if (categoricalSource?.length) {
    categoricalSource.slice(0, 3).forEach((category) => {
      details.push({
        label: category.className,
        value: `${formatPercent(category.fraction)} (${formatSamples(category.count)} samples)`,
      });
    });
  }

  return details;
};

const resolveSummaryDescription = (stats: SpeciesEnvironmentStats): string => {
  const summary = stats.summary;
  const units = stats.units;

  if (isFiniteNumber(summary.q10) && isFiniteNumber(summary.q90)) {
    const low = formatMeasurement(summary.q10, units);
    const high = formatMeasurement(summary.q90, units);
    if (low && high) {
      return `${low} to ${high} (${formatSamples(summary.count)} samples)`;
    }
  }

  if (isFiniteNumber(summary.mean)) {
    const mean = formatMeasurement(summary.mean, units);
    if (mean) {
      return `${mean} average (${formatSamples(summary.count)} samples)`;
    }
  }

  const dominantCategory = stats.dominantCategories?.[0] ?? stats.categoricalDistribution?.[0];
  if (dominantCategory) {
    return `${dominantCategory.className} (${formatPercent(dominantCategory.fraction)})`;
  }

  if ((summary.count ?? 0) > 0) {
    return `${formatSamples(summary.count)} samples recorded`;
  }

  return 'Not enough samples yet';
};

const buildEnvironmentEntry = (
  stats: SpeciesEnvironmentStats,
  fallbackLabel: string,
): EnvironmentalDataEntry | null => {
  const hasSampleData =
    (stats.summary?.count ?? 0) > 0 ||
    (stats.categoricalDistribution?.length ?? 0) > 0 ||
    (stats.dominantCategories?.length ?? 0) > 0;

  if (!hasSampleData) {
    return null;
  }

  const details = buildEnvironmentDetails(stats);

  return {
    dataName: stats.variableName || fallbackLabel || stats.variable,
    dataPoint: resolveSummaryDescription(stats),
    details,
    expandable: details.length > 0,
    showGraph: true,
    environmentGraph: {
      variableId: stats.variable,
      initialStats: stats,
    },
  };
};

const buildEnvironmentSections = (
  stats: { stats: SpeciesEnvironmentStats; fallbackLabel: string }[],
): EnvironmentalDataSection[] => {
  const entries = stats
    .map(({ stats: entryStats, fallbackLabel }) => buildEnvironmentEntry(entryStats, fallbackLabel))
    .filter((entry): entry is EnvironmentalDataEntry => Boolean(entry));

  if (!entries.length) {
    return [];
  }

  return [
    {
      title: ENVIRONMENT_SECTION_TITLE,
      entries,
    },
  ];
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
  const [fetchedEnvironmentSections, setFetchedEnvironmentSections] = React.useState<EnvironmentalDataSection[] | undefined>(undefined);

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

  const resolvedPageData = React.useMemo(
    () => (data ? buildSpeciesPageData(data, requestedTaxonId) : mountainBallCactusData),
    [data, requestedTaxonId],
  );
  const resolvedTaxonId = resolvedPageData.taxonId;

  React.useEffect(() => {
    if (!data || !resolvedTaxonId) {
      setFetchedEnvironmentSections(undefined);
      return;
    }

    let cancelled = false;

    (async () => {
      const settled = await Promise.allSettled(
        ENVIRONMENT_VARIABLE_TARGETS.map(async (target) => {
          const stats = await fetchSpeciesEnvironment(resolvedTaxonId, target.variableId);
          return { stats, fallbackLabel: target.fallbackLabel };
        }),
      );

      if (cancelled) {
        return;
      }

      const fulfilled: { stats: SpeciesEnvironmentStats; fallbackLabel: string }[] = [];

      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          fulfilled.push(result.value);
          return;
        }
        const { variableId } = ENVIRONMENT_VARIABLE_TARGETS[index];
        const reason = result.reason instanceof Error ? result.reason.message : result.reason;
        console.warn(`Failed to load ${variableId} stats for taxon ${resolvedTaxonId}:`, reason);
      });

      setFetchedEnvironmentSections(buildEnvironmentSections(fulfilled));
    })();

    return () => {
      cancelled = true;
    };
  }, [data, resolvedTaxonId]);

  const hydratedPageData = React.useMemo(
    () => {
      const merged =
        fetchedEnvironmentSections && fetchedEnvironmentSections.length > 0
          ? fetchedEnvironmentSections
          : resolvedPageData.dataSections ?? [];
      return {
        ...resolvedPageData,
        dataSections: merged,
      };
    },
    [fetchedEnvironmentSections, resolvedPageData],
  );

  if (loading && !data) {
    return null;
  }

  return <SpeciesPage data={hydratedPageData} />;
}

export const __SPECIES_BASICS_TESTING__ = {
  normalizeImageSource,
  buildSpeciesPageData,
  getIdentifierFromParams,
  buildEnvironmentEntry,
  buildEnvironmentSections,
  resolveSummaryDescription,
  ENVIRONMENT_VARIABLE_TARGETS,
};
