import { createSpeciesDataSource, type SpeciesDataSource } from '@/data/speciesDataSource';
import type {
  LocationSearchResult,
  SpeciesEnvironmentCategorySampleResponse,
  SpeciesEnvironmentObservation,
  SpeciesEnvironmentSliceResponse,
  SpeciesEnvironmentStats,
  SpeciesOccurrence,
  SpeciesOccurrencesResult,
} from '@/data/types';
import { isCategoricalAggregateMetric } from '@/data/uploadLocalSpeciesDataSource.shared';
import { validateUploadedParquetBundle } from '@/data/uploadLocalSpeciesDataSource.normalize';
import type {
  UploadedCategoricalStatsRow,
  UploadedDensityGraphPoint,
  UploadedOccurrenceIndexRow,
  UploadedOccurrenceRow,
  UploadedParquetBundle,
  UploadedSummaryStatsRow,
} from '@/data/uploadLocalSpeciesDataSource.types';

type BuildLocalSpeciesDataSourceOptions = {
  bundle: UploadedParquetBundle;
  speciesId?: number;
};

const DEFAULT_SPECIES_ID = 0;
const LOCATION_LEVEL_TO_NUMBER: Record<string, number> = {
  continent: -1,
  country: 0,
  state: 1,
  county: 2,
};

const normalizeLocationLevel = (level: string | number | undefined) => {
  if (typeof level === 'number') {
    return level;
  }

  if (typeof level === 'string') {
    return LOCATION_LEVEL_TO_NUMBER[level.toLowerCase()];
  }

  return undefined;
};

const normalizeLocationToken = (value: string | null | undefined) => {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

const findLocationsByNameToken = (
  normalizedName: string,
  locationLookup: ReturnType<typeof buildLocationLookupMaps>,
) => {
  if (!normalizedName) {
    return [] as LocationSearchResult[];
  }

  return Array.from(locationLookup.byGid.values()).filter(
    (location) => normalizeLocationToken(location.name) === normalizedName,
  );
};

const buildLocationLookupMaps = (locations: LocationSearchResult[]) => {
  const byGid = new Map<string, LocationSearchResult>();
  const byName = new Map<string, LocationSearchResult>();

  locations.forEach((location) => {
    const normalizedGid = normalizeLocationToken(location.gid);
    const normalizedName = normalizeLocationToken(location.name);

    if (normalizedGid) {
      byGid.set(normalizedGid, location);
    }

    if (normalizedName && !byName.has(normalizedName)) {
      byName.set(normalizedName, location);
    }
  });

  return { byGid, byName };
};

const resolveLocationEntry = (
  token: string | null | undefined,
  locationLookup: ReturnType<typeof buildLocationLookupMaps>,
) => {
  const normalizedToken = normalizeLocationToken(token);
  if (!normalizedToken) {
    return null;
  }

  return locationLookup.byGid.get(normalizedToken) ?? locationLookup.byName.get(normalizedToken) ?? null;
};

const buildScopeTokens = (
  token: string,
  locationLookup: ReturnType<typeof buildLocationLookupMaps>,
) => {
  const normalizedToken = normalizeLocationToken(token);
  const resolvedByGid = locationLookup.byGid.get(normalizedToken);
  const matchingEntriesByName = resolvedByGid
    ? []
    : findLocationsByNameToken(normalizedToken, locationLookup);

  return new Set(
    resolvedByGid
      ? [normalizeLocationToken(resolvedByGid.gid)].filter(Boolean)
      : [
          normalizedToken,
          ...matchingEntriesByName.map((location) => normalizeLocationToken(location.gid)),
        ].filter(Boolean),
  );
};

const matchesParentLocation = (
  location: { gid: string; name: string; hierarchy: string[] },
  parent: string,
  locationLookup: ReturnType<typeof buildLocationLookupMaps>,
) => {
  const scopeTokens = buildScopeTokens(parent, locationLookup);
  if (!scopeTokens.size) {
    return true;
  }

  if (scopeTokens.has(normalizeLocationToken(location.gid))) {
    return true;
  }

  return location.hierarchy.some((entry) => {
    const normalizedEntry = normalizeLocationToken(entry);
    return scopeTokens.has(normalizedEntry);
  });
};

const toSpeciesOccurrences = (rows: UploadedOccurrenceRow[]): SpeciesOccurrence[] => {
  return rows
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude))
    .map((row) => ({
      catalogNumber: row.catalogNumber,
      latitude: row.latitude,
      longitude: row.longitude,
    }));
};

const buildStatsByVariable = (
  bundle: UploadedParquetBundle,
  speciesId: number,
): Record<string, SpeciesEnvironmentStats> => {
  const summaryByVariable = bundle.summaryStats.reduce<Record<string, UploadedSummaryStatsRow>>(
    (acc, row) => {
      acc[row.variable] = row;
      return acc;
    },
    {},
  );

  const densityByVariable = bundle.densityGraph.reduce<Record<string, UploadedDensityGraphPoint[]>>(
    (acc, row) => {
      if (!acc[row.variable]) {
        acc[row.variable] = [];
      }
      acc[row.variable].push(row);
      return acc;
    },
    {},
  );

  const categoricalByVariable = bundle.categoricalStats.reduce<Record<string, UploadedCategoricalStatsRow[]>>(
    (acc, row) => {
      if (!acc[row.variable]) {
        acc[row.variable] = [];
      }
      acc[row.variable].push(row);
      return acc;
    },
    {},
  );

  const categoricalLookupByVariableAndMetric = (bundle.categoricalValueLookup ?? []).reduce<
    Record<string, Record<string, { label?: string | null; description?: string | null }>>
  >((acc, row) => {
    if (!acc[row.variable]) {
      acc[row.variable] = {};
    }
    acc[row.variable][row.metric] = {
      label: row.label,
      description: row.description,
    };
    return acc;
  }, {});

  const variableDefinitionsById = new Map(
    (bundle.variableDefinitions ?? []).map((definition) => [definition.id, definition]),
  );

  const variableIds = new Set<string>([
    ...Object.keys(summaryByVariable),
    ...Object.keys(densityByVariable),
    ...Object.keys(categoricalByVariable),
  ]);

  return Array.from(variableIds).reduce<Record<string, SpeciesEnvironmentStats>>((acc, variable) => {
    const summaryRow = summaryByVariable[variable];
    const variableDefinition = variableDefinitionsById.get(variable);
    const densityRows = densityByVariable[variable] ?? [];
    const categoryRows = categoricalByVariable[variable] ?? [];
    const categoryLookupByMetric = categoricalLookupByVariableAndMetric[variable] ?? {};
    const totalSamplesRow = categoryRows.find((entry) => entry.metric === 'total_samples');
    const totalSamples =
      totalSamplesRow && Number.isFinite(totalSamplesRow.value) ? totalSamplesRow.value : null;
    const classRows = categoryRows.filter((entry) => !isCategoricalAggregateMetric(entry.metric));
    const isCategoricalVariable = classRows.length > 0;

    const categoricalDistribution = classRows
      .filter((entry) => Number.isFinite(entry.value))
      .map((entry) => {
        const fraction = entry.value;
        const count =
          typeof totalSamples === 'number' && Number.isFinite(totalSamples)
            ? Math.round(totalSamples * fraction)
            : 0;

        return {
          value: entry.metric,
          className: entry.metricLabel ?? categoryLookupByMetric[entry.metric]?.label ?? entry.metric,
          description: categoryLookupByMetric[entry.metric]?.description ?? null,
          count,
          fraction,
        };
      });

    const inferredCount =
      typeof totalSamples === 'number' && Number.isFinite(totalSamples)
        ? Math.max(0, Math.round(totalSamples))
        : categoricalDistribution.reduce(
            (sum, entry) => sum + (Number.isFinite(entry.count) ? entry.count : 0),
            0,
          );

    acc[variable] = {
      speciesId,
      variable,
      variableName: summaryRow?.variableName ?? variableDefinition?.name ?? variable,
      units: summaryRow?.units ?? variableDefinition?.units ?? null,
      variableType:
        summaryRow?.variableType
        ?? variableDefinition?.valueType
        ?? (isCategoricalVariable ? 'categorical' : null),
      summary: {
        count: summaryRow?.count ?? inferredCount,
        min: summaryRow?.min ?? null,
        mean: summaryRow?.mean ?? null,
        max: summaryRow?.max ?? null,
        stddev: summaryRow?.stddev ?? null,
        q01: summaryRow?.q01 ?? null,
        q10: summaryRow?.q10 ?? null,
        q90: summaryRow?.q90 ?? null,
        q99: summaryRow?.q99 ?? null,
      },
      histogram:
        Array.isArray(summaryRow?.bins) && Array.isArray(summaryRow?.counts)
          ? {
              bins: summaryRow.bins,
              counts: summaryRow.counts,
            }
          : null,
      densityCurve:
        densityRows.length > 0
          ? {
              points: densityRows.map((point) => point.value),
              density: densityRows.map((point) => point.density),
            }
          : null,
      categoricalDistribution,
    };
    return acc;
  }, {});
};

const collectCatalogsForRange = (
  indexRows: UploadedOccurrenceIndexRow[],
  min: number,
  max: number,
) => {
  const catalogs = indexRows
    .filter((row) => row.mode === 'range')
    .filter((row) => typeof row.min === 'number' && typeof row.max === 'number')
    .filter((row) => (row.max as number) >= min && (row.min as number) <= max)
    .flatMap((row) => row.observationIds);

  return Array.from(new Set(catalogs.map((id) => String(id))));
};

const collectCatalogsForCategory = (
  indexRows: UploadedOccurrenceIndexRow[],
  classValue: string | number,
) => {
  const normalizedClassValue = String(classValue);
  const catalogs = indexRows
    .filter((row) => row.mode === 'category')
    .filter((row) => String(row.classValue) === normalizedClassValue)
    .flatMap((row) => row.observationIds);

  return Array.from(new Set(catalogs.map((id) => String(id))));
};

const findObservationEnvironmentValue = (
  indexRows: UploadedOccurrenceIndexRow[],
  catalogNumber: string | number,
) => {
  const targetCatalog = String(catalogNumber);
  const matchedRow = indexRows.find((row) =>
    row.observationIds.some((id) => String(id) === targetCatalog),
  );

  if (!matchedRow) {
    return null;
  }

  if (matchedRow.mode === 'category') {
    return matchedRow.classValue ?? null;
  }

  return typeof matchedRow.min === 'number' ? matchedRow.min : null;
};

const findCategoricalDistributionEntry = (
  stats: SpeciesEnvironmentStats | undefined,
  value: string | number | null,
) => {
  if (!stats?.categoricalDistribution || value === null) {
    return null;
  }

  const normalizedValue = String(value);
  return (
    stats.categoricalDistribution.find((entry) => String(entry.value) === normalizedValue) ?? null
  );
};

const toObservationsByCatalog = (rows: UploadedOccurrenceRow[]) => {
  return rows.reduce<Record<string, UploadedOccurrenceRow>>((acc, row) => {
    acc[String(row.catalogNumber)] = row;
    return acc;
  }, {});
};

const groupIndexRowsByVariable = (rows: UploadedOccurrenceIndexRow[]) => {
  return rows.reduce<Record<string, UploadedOccurrenceIndexRow[]>>((acc, row) => {
    if (!acc[row.variable]) {
      acc[row.variable] = [];
    }
    acc[row.variable].push(row);
    return acc;
  }, {});
};

const matchesObservationLocation = (
  rowLocationGid: string | null | undefined,
  locationLookup: ReturnType<typeof buildLocationLookupMaps>,
  locationGid?: string | null,
) => {
  if (!locationGid) {
    return true;
  }

  if (!rowLocationGid) {
    return false;
  }

  const rowLocation = resolveLocationEntry(rowLocationGid, locationLookup);
  if (!rowLocation) {
    return normalizeLocationToken(rowLocationGid) === normalizeLocationToken(locationGid);
  }

  return matchesParentLocation(rowLocation, locationGid, locationLookup);
};

const filterCatalogIdsByLocation = (
  catalogIds: Array<number | string>,
  observationsByCatalog: Record<string, UploadedOccurrenceRow>,
  locationLookup: ReturnType<typeof buildLocationLookupMaps>,
  locationGid?: string | null,
) => {
  if (!locationGid) {
    return catalogIds;
  }

  return catalogIds.filter((id) => {
    const rowLocationGid = observationsByCatalog[String(id)]?.locationGid;
    return matchesObservationLocation(rowLocationGid, locationLookup, locationGid);
  });
};

const toSortedNumericValues = (values: number[]) => values.slice().sort((left, right) => left - right);

const quantileFromSortedValues = (values: number[], quantile: number) => {
  if (!values.length) {
    return null;
  }

  const clamped = Math.min(1, Math.max(0, quantile));
  const position = (values.length - 1) * clamped;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) {
    return values[lowerIndex];
  }

  const weight = position - lowerIndex;
  return values[lowerIndex] * (1 - weight) + values[upperIndex] * weight;
};

const buildHistogramFromValues = (values: number[], desiredBucketCount?: number) => {
  if (!values.length) {
    return null;
  }

  const sortedValues = toSortedNumericValues(values);
  const min = sortedValues[0];
  const max = sortedValues[sortedValues.length - 1];
  if (min === max) {
    const spread = Math.max(Math.abs(min) * 0.01, 1e-6);
    return {
      bins: [min - spread, min + spread],
      counts: [sortedValues.length],
    };
  }

  const bucketCount = Math.max(
    1,
    desiredBucketCount ?? Math.min(12, Math.ceil(Math.sqrt(sortedValues.length))),
  );
  const span = max - min;
  const step = span / bucketCount;
  const bins = Array.from({ length: bucketCount + 1 }, (_, index) => min + step * index);
  const counts = Array.from({ length: bucketCount }, () => 0);

  sortedValues.forEach((value) => {
    const rawIndex = Math.floor(((value - min) / span) * bucketCount);
    const index = Math.min(bucketCount - 1, Math.max(0, rawIndex));
    counts[index] += 1;
  });

  return { bins, counts };
};

const buildDensityCurveFromHistogram = (
  histogram: { bins: number[]; counts: number[] } | null,
  totalCount: number,
) => {
  if (!histogram || !histogram.bins.length || !totalCount) {
    return null;
  }

  return {
    points: histogram.counts.map(
      (_, index) => histogram.bins[index] + (histogram.bins[index + 1] - histogram.bins[index]) / 2,
    ),
    density: histogram.counts.map((count) => count / totalCount),
  };
};

const buildScopedCategoricalStats = ({
  stats,
  locationGid,
  observationsByCatalog,
  locationLookup,
  indexRows,
}: {
  stats: SpeciesEnvironmentStats;
  locationGid: string;
  observationsByCatalog: Record<string, UploadedOccurrenceRow>;
  locationLookup: ReturnType<typeof buildLocationLookupMaps>;
  indexRows: UploadedOccurrenceIndexRow[];
}): SpeciesEnvironmentStats => {
  const countsByClass = new Map<string, number>();
  let totalCount = 0;

  indexRows
    .filter((row) => row.mode === 'category')
    .forEach((row) => {
      const scopedObservationIds = filterCatalogIdsByLocation(
        row.observationIds,
        observationsByCatalog,
        locationLookup,
        locationGid,
      );
      if (!scopedObservationIds.length) {
        return;
      }

      const classKey = String(row.classValue ?? '');
      countsByClass.set(classKey, (countsByClass.get(classKey) ?? 0) + scopedObservationIds.length);
      totalCount += scopedObservationIds.length;
    });

  const baselineDistribution = stats.categoricalDistribution ?? [];
  const categoricalDistribution = Array.from(countsByClass.entries())
    .map(([classValue, count]) => {
      const baseline = baselineDistribution.find((entry) => String(entry.value) === classValue);
      return {
        value: baseline?.value ?? classValue,
        className: baseline?.className ?? classValue,
        description: baseline?.description ?? null,
        count,
        fraction: totalCount > 0 ? count / totalCount : 0,
      };
    })
    .sort((left, right) => right.count - left.count);

  return {
    ...stats,
    summary: {
      count: totalCount,
      min: null,
      mean: null,
      max: null,
      stddev: null,
      q01: null,
      q10: null,
      q90: null,
      q99: null,
    },
    categoricalDistribution,
    baselineSummary: stats.summary,
    baselineCategoricalDistribution: baselineDistribution,
  };
};

const buildScopedNumericStats = ({
  stats,
  locationGid,
  observationsByCatalog,
  locationLookup,
  indexRows,
}: {
  stats: SpeciesEnvironmentStats;
  locationGid: string;
  observationsByCatalog: Record<string, UploadedOccurrenceRow>;
  locationLookup: ReturnType<typeof buildLocationLookupMaps>;
  indexRows: UploadedOccurrenceIndexRow[];
}): SpeciesEnvironmentStats => {
  const scopedValues = indexRows
    .filter((row) => row.mode === 'range')
    .flatMap((row) => {
      if (typeof row.min !== 'number' || typeof row.max !== 'number') {
        return [];
      }

      const scopedObservationIds = filterCatalogIdsByLocation(
        row.observationIds,
        observationsByCatalog,
        locationLookup,
        locationGid,
      );
      if (!scopedObservationIds.length) {
        return [];
      }

      const value = row.min === row.max ? row.min : (row.min + row.max) / 2;
      return scopedObservationIds.map(() => value);
    });

  const sortedValues = toSortedNumericValues(scopedValues);
  const count = sortedValues.length;
  const min = count ? sortedValues[0] : null;
  const max = count ? sortedValues[count - 1] : null;
  const mean = count ? sortedValues.reduce((sum, value) => sum + value, 0) / count : null;
  const variance =
    count > 0 && mean !== null
      ? sortedValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count
      : null;
  const histogram = buildHistogramFromValues(sortedValues, stats.histogram?.counts.length);

  return {
    ...stats,
    summary: {
      count,
      min,
      mean,
      max,
      stddev: variance !== null ? Math.sqrt(variance) : null,
      q01: quantileFromSortedValues(sortedValues, 0.01),
      q10: quantileFromSortedValues(sortedValues, 0.1),
      q90: quantileFromSortedValues(sortedValues, 0.9),
      q99: quantileFromSortedValues(sortedValues, 0.99),
    },
    histogram,
    densityCurve: buildDensityCurveFromHistogram(histogram, count),
    baselineSummary: stats.summary,
  };
};

const buildScopedStats = ({
  stats,
  locationGid,
  observationsByCatalog,
  locationLookup,
  indexRows,
}: {
  stats: SpeciesEnvironmentStats;
  locationGid?: string | null;
  observationsByCatalog: Record<string, UploadedOccurrenceRow>;
  locationLookup: ReturnType<typeof buildLocationLookupMaps>;
  indexRows: UploadedOccurrenceIndexRow[];
}): SpeciesEnvironmentStats => {
  if (!locationGid) {
    return stats;
  }

  const isCategorical =
    stats.variableType?.toLowerCase() === 'categorical' || (stats.categoricalDistribution?.length ?? 0) > 0;

  if (isCategorical) {
    return buildScopedCategoricalStats({
      stats,
      locationGid,
      observationsByCatalog,
      locationLookup,
      indexRows,
    });
  }

  return buildScopedNumericStats({
    stats,
    locationGid,
    observationsByCatalog,
    locationLookup,
    indexRows,
  });
};

const pickOccurrenceObservations = (
  catalogIds: Array<number | string>,
  observationsByCatalog: Record<string, UploadedOccurrenceRow>,
): SpeciesEnvironmentObservation[] => {
  return catalogIds
    .map((id) => observationsByCatalog[String(id)])
    .filter(Boolean)
    .map((row) => ({
      catalogNumber: row.catalogNumber,
      value: null,
      latitude: row.latitude,
      longitude: row.longitude,
    }));
};

export const buildUploadLocalSpeciesDataSource = ({
  bundle,
  speciesId = DEFAULT_SPECIES_ID,
}: BuildLocalSpeciesDataSourceOptions): SpeciesDataSource => {
  validateUploadedParquetBundle(bundle);

  const statsByVariable = buildStatsByVariable(bundle, speciesId);
  const supportedVariableIds = new Set(Object.keys(statsByVariable));
  const occurrences = toSpeciesOccurrences(bundle.occurrences);
  const observationsByCatalog = toObservationsByCatalog(bundle.occurrences);
  const indexRowsByVariable = groupIndexRowsByVariable(bundle.occurrenceIndex);
  const locations = bundle.locations ?? [];
  const locationLookup = buildLocationLookupMaps(locations);

  return createSpeciesDataSource({
    locationParentIdentityMode: 'gid',
    fetchEnvironmentVariables: async () => {
      if (bundle.variableDefinitions && bundle.variableDefinitions.length > 0) {
        return bundle.variableDefinitions.filter((definition) => supportedVariableIds.has(definition.id));
      }

      return Array.from(supportedVariableIds).map((variable) => {
        const stats = statsByVariable[variable];
        return {
          id: variable,
          name: stats.variableName,
          units: stats.units ?? null,
          valueType: stats.variableType ?? null,
          category: null,
        };
      });
    },

    fetchSpeciesEnvironment: async (_taxonId, variableId, options) => {
      const stats = statsByVariable[variableId];
      if (!stats) {
        throw new Error(`Local upload does not include stats for variable: ${variableId}`);
      }

      return buildScopedStats({
        stats,
        locationGid: options?.location,
        observationsByCatalog,
        locationLookup,
        indexRows: indexRowsByVariable[variableId] ?? [],
      });
    },

    fetchEnvironmentRangeSlice: async (params) => {
      const indexRows = indexRowsByVariable[params.variableId] ?? [];
      const catalogs = filterCatalogIdsByLocation(
        collectCatalogsForRange(indexRows, params.min, params.max),
        observationsByCatalog,
        locationLookup,
        params.location,
      );
      const observations = pickOccurrenceObservations(catalogs, observationsByCatalog);

      const response: SpeciesEnvironmentSliceResponse = {
        speciesId,
        variable: params.variableId,
        range: {
          min: params.min,
          max: params.max,
        },
        limit: params.limit ?? null,
        count: observations.length,
        observations,
      };

      return response;
    },

    fetchSpeciesEnvironmentCategorySamples: async (_taxonId, variableId, classValue, options) => {
      const indexRows = indexRowsByVariable[variableId] ?? [];
      const catalogs = filterCatalogIdsByLocation(
        collectCatalogsForCategory(indexRows, classValue),
        observationsByCatalog,
        locationLookup,
        options?.location,
      );
      const observations = pickOccurrenceObservations(catalogs, observationsByCatalog);

      const response: SpeciesEnvironmentCategorySampleResponse = {
        speciesId,
        variable: variableId,
        classValue,
        count: observations.length,
        observations,
      };

      return response;
    },

    fetchObservationEnvironmentValue: async (_taxonId, catalogNumber, variableId, options) => {
      const stats = statsByVariable[variableId];
      const row = observationsByCatalog[String(catalogNumber)];
      if (!row) {
        return {
          variable: variableId,
          value: null,
          valueLabel: null,
          valueDescription: null,
          units: stats?.units ?? null,
        };
      }

      if (!matchesObservationLocation(row.locationGid, locationLookup, options?.location)) {
        return {
          variable: variableId,
          value: null,
          valueLabel: null,
          valueDescription: null,
          units: stats?.units ?? null,
        };
      }

      const value = findObservationEnvironmentValue(indexRowsByVariable[variableId] ?? [], catalogNumber);
      const categoryEntry = findCategoricalDistributionEntry(stats, value);

      return {
        variable: variableId,
        value,
        valueLabel: categoryEntry?.className ?? null,
        valueDescription: categoryEntry?.description ?? null,
        units: stats?.units ?? null,
      };
    },

    fetchSpeciesOccurrences: async (_taxonId, options) => {
      const selectedLocation = options?.location;
      const filtered = !selectedLocation
        ? occurrences
        : occurrences.filter((occurrence) => {
            const row = observationsByCatalog[String(occurrence.catalogNumber)];
            if (!row?.locationGid) {
              return false;
            }
            const rowLocation = resolveLocationEntry(row.locationGid, locationLookup);
            if (!rowLocation) {
              return normalizeLocationToken(row.locationGid) === normalizeLocationToken(selectedLocation);
            }
            return matchesParentLocation(rowLocation, selectedLocation, locationLookup);
          });
      return { occurrences: filtered, minTimestamp: null, maxTimestamp: null };
    },

    fetchSpeciesLocations: async (_taxonId, level, parent, limit = 500) => {
      const normalizedLevel = normalizeLocationLevel(level);
      const filtered = locations.filter((location) => {
        if (typeof normalizedLevel === 'number' && location.level !== normalizedLevel) {
          return false;
        }

        if (!parent) {
          return true;
        }

        return matchesParentLocation(location, parent, locationLookup);
      });

      return filtered.slice(0, limit);
    },
  });
};
