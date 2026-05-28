import type { EnvironmentVariableDefinition } from '@/data/types';
import {
  getVariableMetadataDisplayName,
  getVariableMetadataId,
  getVariableMetadataValueType,
  isCategoricalAggregateMetric,
  parseNumericArrayFromUnknown,
  resolveCategoryMetricValue,
  toFiniteNumber,
  toStringValue,
} from '@/data/uploadLocalSpeciesDataSource.shared';
import {
  type RawUploadedParquetBundle,
  type UploadedCategoricalStatsRow,
  type UploadedCategoricalValueLookupRow,
  type UploadedDensityGraphPoint,
  type UploadedOccurrenceIndexRow,
  type UploadedOccurrenceRow,
  type UploadedParquetBundle,
  type UploadedSummaryStatsRow,
  UploadedParquetBundleValidationError,
} from '@/data/uploadLocalSpeciesDataSource.types';

export const validateUploadedParquetBundle = (bundle: UploadedParquetBundle): void => {
  const issues: string[] = [];

  if (!bundle.summaryStats.length) {
    issues.push('summary_stats did not produce any valid rows');
  }

  if (!bundle.occurrences.length) {
    issues.push('occurrence did not produce any valid rows');
  }

  if (!bundle.occurrenceIndex.length) {
    issues.push('occurrence_index did not produce any valid rows');
  }

  const summaryVariables = new Set(bundle.summaryStats.map((row) => row.variable));
  const indexVariables = new Set(bundle.occurrenceIndex.map((row) => row.variable));
  const missingIndexVariables = Array.from(summaryVariables).filter(
    (variable) => !indexVariables.has(variable),
  );
  if (missingIndexVariables.length) {
    issues.push(
      `occurrence_index missing variables present in summary_stats: ${missingIndexVariables.join(', ')}`,
    );
  }

  const occurrenceCatalogs = new Set(bundle.occurrences.map((row) => String(row.catalogNumber)));
  const missingCatalogIds = bundle.occurrenceIndex
    .flatMap((row) => row.observationIds)
    .map((id) => String(id))
    .filter((id) => !occurrenceCatalogs.has(id));

  if (missingCatalogIds.length) {
    const sample = Array.from(new Set(missingCatalogIds)).slice(0, 10);
    issues.push(`occurrence_index references catalogNumber values not found in occurrence: ${sample.join(', ')}`);
  }

  if (issues.length) {
    throw new UploadedParquetBundleValidationError(issues);
  }
};

export const normalizeRawUploadedParquetBundle = (
  rawBundle: RawUploadedParquetBundle,
): UploadedParquetBundle => {
  const variableDisplayNameById = new Map<string, string>();
  const variableUnitsById = new Map<string, string>();
  const variableTypeById = new Map<string, string>();

  const assignDisplayName = (variable: string, value: unknown) => {
    const displayName = toStringValue(value);
    if (!displayName || variableDisplayNameById.has(variable)) {
      return;
    }
    variableDisplayNameById.set(variable, displayName);
  };

  const assignUnits = (variable: string, value: unknown) => {
    const units = toStringValue(value);
    if (!units || variableUnitsById.has(variable)) {
      return;
    }
    variableUnitsById.set(variable, units);
  };

  const assignValueType = (variable: string, value: unknown) => {
    const valueType = toStringValue(value);
    if (!valueType || variableTypeById.has(variable)) {
      return;
    }
    variableTypeById.set(variable, valueType);
  };

  rawBundle.variableDefinitions?.forEach((definition) => {
    if (!definition?.id) {
      return;
    }
    assignDisplayName(definition.id, definition.name);
    assignUnits(definition.id, definition.units);
    assignValueType(definition.id, definition.valueType);
  });

  rawBundle.variableMetadata?.forEach((row) => {
    const canonicalId = getVariableMetadataId(row);
    if (!canonicalId) {
      return;
    }
    assignDisplayName(canonicalId, getVariableMetadataDisplayName(row));
    assignUnits(canonicalId, row.units);
    assignValueType(canonicalId, getVariableMetadataValueType(row));
  });

  const categoricalStats = rawBundle.categoricalStats
    .map((row): UploadedCategoricalStatsRow | null => {
      const variable = toStringValue(row.variable);
      const variableCategory = toStringValue(row.variableCategory);
      const metric = toStringValue(row.metric);
      const metricLabel = toStringValue(row.metricLabel);
      const value = toFiniteNumber(row.value);
      if (!variable || !metric || value === null) {
        return null;
      }
      assignDisplayName(variable, row.variableName);
      return { variable, variableCategory, metric, metricLabel, value };
    })
    .filter((row): row is UploadedCategoricalStatsRow => row !== null);

  const categoricalValueLookup = (rawBundle.categoricalValueLookup ?? [])
    .map((row): UploadedCategoricalValueLookupRow | null => {
      const variable = toStringValue(row.variable);
      const code = toStringValue(row.code);
      const metric = toStringValue(row.metric);
      if (!variable || !code || !metric) {
        return null;
      }

      assignDisplayName(variable, row.variableName);
      assignValueType(variable, 'categorical');

      return {
        variable,
        variableName: toStringValue(row.variableName),
        variableCategory: toStringValue(row.variableCategory),
        code,
        metric,
        label: toStringValue(row.label),
        description: toStringValue(row.description),
        group: toStringValue(row.group),
        groupLabel: toStringValue(row.groupLabel),
      };
    })
    .filter((row): row is UploadedCategoricalValueLookupRow => row !== null);

  const densityGraph = rawBundle.densityGraph.flatMap((row): UploadedDensityGraphPoint[] => {
    const variable = toStringValue(row.variable);
    const variableCategory = toStringValue(row.variableCategory);
    if (!variable) {
      return [];
    }

    assignDisplayName(variable, row.variableName);

    const points = parseNumericArrayFromUnknown(row.points);
    const densities = parseNumericArrayFromUnknown(row.density);
    const pairCount = Math.min(points.length, densities.length);
    const output: UploadedDensityGraphPoint[] = [];

    for (let index = 0; index < pairCount; index += 1) {
      output.push({
        variable,
        variableCategory,
        value: points[index],
        density: densities[index],
      });
    }

    return output;
  });

  const occurrences = rawBundle.occurrences
    .map((row): UploadedOccurrenceRow | null => {
      const catalogNumber = toStringValue(row.catalogNumber);
      const latitude = toFiniteNumber(row.decimalLatitude);
      const longitude = toFiniteNumber(row.decimalLongitude);

      if (!catalogNumber || latitude === null || longitude === null) {
        return null;
      }

      return {
        catalogNumber,
        latitude,
        longitude,
        locationGid: toStringValue(row.locationGid),
        catalogName: toStringValue(row.observationName),
      };
    })
    .filter((row): row is UploadedOccurrenceRow => row !== null);

  const categoryMetricsByVariable = categoricalStats.reduce<Record<string, string[]>>((acc, row) => {
    if (isCategoricalAggregateMetric(row.metric)) {
      return acc;
    }
    if (!acc[row.variable]) {
      acc[row.variable] = [];
    }
    acc[row.variable].push(row.metric);
    return acc;
  }, {});

  const categoryValueLookupByVariable = categoricalValueLookup.reduce<
    Record<string, UploadedCategoricalValueLookupRow[]>
  >((acc, row) => {
    if (!acc[row.variable]) {
      acc[row.variable] = [];
    }
    acc[row.variable].push(row);
    return acc;
  }, {});

  const categoricalVariables = new Set(Object.keys(categoryMetricsByVariable));
  const categoricalValueWarnings = new Set<string>();

  const OCCURRENCE_INDEX_METADATA_COLUMNS = new Set([
    'catalogNumber',
    'decimalLatitude',
    'decimalLongitude',
    'observationName',
  ]);

  const occurrenceIndex: UploadedOccurrenceIndexRow[] = [];
  rawBundle.occurrenceIndex.forEach((row) => {
    const catalogNumber = toStringValue(row.catalogNumber);
    if (!catalogNumber) {
      return;
    }

    Object.entries(row).forEach(([variable, rawValue]) => {
      if (OCCURRENCE_INDEX_METADATA_COLUMNS.has(variable)) {
        return;
      }
      const canonicalVariable = toStringValue(variable);
      if (!canonicalVariable) {
        return;
      }

      if (categoricalVariables.has(canonicalVariable)) {
        const rawValueStr =
          rawValue === null || rawValue === undefined ? '' : String(rawValue);
        if (!rawValueStr || rawValueStr === 'nan' || rawValueStr === 'None') {
          return;
        }
        const classValue = resolveCategoryMetricValue(
          canonicalVariable,
          rawValueStr,
          categoryValueLookupByVariable,
        );
        const normalizedClassValue = classValue.trim().toLowerCase();
        const matchedMetric = categoryMetricsByVariable[canonicalVariable]?.some(
          (metric) => metric.trim().toLowerCase() === normalizedClassValue,
        );

        if (!matchedMetric) {
          const variableLabel = variableDisplayNameById.get(canonicalVariable) ?? canonicalVariable;
          categoricalValueWarnings.add(
            `Uploaded categorical variable "${variableLabel}" has occurrence_index codes that do not resolve through categorical_value_lookup, so categorical highlighting may be unavailable.`,
          );
        }

        occurrenceIndex.push({
          variable: canonicalVariable,
          mode: 'category',
          classValue,
          observationIds: [catalogNumber],
        });
        return;
      }

      const numericValue = toFiniteNumber(rawValue);
      if (numericValue === null) {
        return;
      }

      occurrenceIndex.push({
        variable: canonicalVariable,
        mode: 'range',
        min: numericValue,
        max: numericValue,
        observationIds: [catalogNumber],
      });
    });
  });

  const summaryStats = [...rawBundle.summaryStats, ...(rawBundle.circularStats ?? [])]
    .map((row): UploadedSummaryStatsRow | null => {
      const variable = toStringValue(row.variable);
      const variableCategory = toStringValue(row.variableCategory);
      const variableName = toStringValue(row.variableName) ?? toStringValue(row.variable_name);
      const units = toStringValue(row.units);
      const variableType =
        toStringValue(row.variableType)
        ?? toStringValue(row.variable_type)
        ?? toStringValue(row.valueType)
        ?? toStringValue(row.value_type);
      const domain = toStringValue(row.domain);
      const count = toFiniteNumber(row.count);
      if (!variable || count === null) {
        return null;
      }

      assignDisplayName(variable, variableName);
      assignUnits(variable, units);
      assignValueType(variable, variableType);

      return {
        variable,
        variableCategory,
        variableName: variableName ?? undefined,
        units,
        variableType,
        domain,
        count,
        min: toFiniteNumber(row.min),
        mean: toFiniteNumber(row.mean),
        max: toFiniteNumber(row.max),
        stddev: toFiniteNumber(row.std),
        q10: toFiniteNumber(row['10th percentile']),
        q90: toFiniteNumber(row['90th percentile']),
      };
    })
    .filter((row): row is UploadedSummaryStatsRow => row !== null);

  const categoryByVariable = new Map<string, string>();
  const assignCategory = (variable: string, category: unknown) => {
    const normalizedCategory = toStringValue(category);
    if (!normalizedCategory || categoryByVariable.has(variable)) {
      return;
    }
    categoryByVariable.set(variable, normalizedCategory);
  };

  const domainByVariable = new Map<string, string>();
  summaryStats.forEach((row) => {
    const domain = toStringValue(row.domain);
    if (domain && !domainByVariable.has(row.variable)) {
      domainByVariable.set(row.variable, domain);
    }
  });

  const groupByVariable = new Map<string, string>();
  const groupLabelByVariable = new Map<string, string>();
  const sortOrderByVariable = new Map<string, number>();

  categoricalStats.forEach((row) => assignCategory(row.variable, row.variableCategory));
  categoricalValueLookup.forEach((row) => assignCategory(row.variable, row.variableCategory));
  densityGraph.forEach((row) => assignCategory(row.variable, row.variableCategory));
  summaryStats.forEach((row) => assignCategory(row.variable, row.variableCategory));

  rawBundle.variableMetadata?.forEach((row) => {
    const variableId = getVariableMetadataId(row);
    if (!variableId) {
      return;
    }
    assignCategory(variableId, row.category);
    const group = toStringValue(row.group);
    if (group && !groupByVariable.has(variableId)) {
      groupByVariable.set(variableId, group);
    }
    const groupLabel = toStringValue(row.group_label);
    if (groupLabel && !groupLabelByVariable.has(variableId)) {
      groupLabelByVariable.set(variableId, groupLabel);
    }
    const sortOrder = toFiniteNumber(row.sort_order);
    if (sortOrder !== null && !sortOrderByVariable.has(variableId)) {
      sortOrderByVariable.set(variableId, sortOrder);
    }
  });

  const variableIds = new Set<string>([
    ...summaryStats.map((row) => row.variable),
    ...categoricalStats.map((row) => row.variable),
    ...categoricalValueLookup.map((row) => row.variable),
    ...densityGraph.map((row) => row.variable),
    ...occurrenceIndex.map((row) => row.variable),
    ...(rawBundle.variableMetadata ?? [])
      .map(getVariableMetadataId)
      .filter((value): value is string => Boolean(value)),
    ...(rawBundle.variableDefinitions ?? []).map((definition) => definition.id),
  ]);

  const variableDefinitionsById = new Map<string, EnvironmentVariableDefinition>();

  rawBundle.variableDefinitions?.forEach((definition) => {
    if (definition?.id) {
      variableDefinitionsById.set(definition.id, { ...definition });
    }
  });

  const sourceIdsByVariable = new Map<string, string[]>();

  rawBundle.variableMetadata?.forEach((row) => {
    const variableId = getVariableMetadataId(row);
    if (!variableId) {
      return;
    }

    // Parse source_ids JSON string written by the backend manifest
    if (row.source_ids != null && !sourceIdsByVariable.has(variableId)) {
      try {
        const parsed = typeof row.source_ids === 'string'
          ? JSON.parse(row.source_ids)
          : row.source_ids;
        if (Array.isArray(parsed)) {
          const ids = parsed.filter((v): v is string => typeof v === 'string');
          if (ids.length > 0) {
            sourceIdsByVariable.set(variableId, ids);
          }
        }
      } catch {
        // Ignore malformed source_ids
      }
    }

    const existing = variableDefinitionsById.get(variableId);
    variableDefinitionsById.set(variableId, {
      id: variableId,
      name: getVariableMetadataDisplayName(row) ?? existing?.name ?? variableDisplayNameById.get(variableId) ?? variableId,
      units: toStringValue(row.units) ?? existing?.units ?? variableUnitsById.get(variableId) ?? null,
      valueType: getVariableMetadataValueType(row) ?? existing?.valueType ?? variableTypeById.get(variableId) ?? null,
      description: existing?.description ?? null,
      category: toStringValue(row.category) ?? existing?.category ?? categoryByVariable.get(variableId) ?? null,
    });
  });

  const normalizedVariableDefinitions = Array.from(variableIds)
    .sort((a, b) => {
      const orderA = sortOrderByVariable.get(a) ?? Infinity;
      const orderB = sortOrderByVariable.get(b) ?? Infinity;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    })
    .map((variable): EnvironmentVariableDefinition => {
      const existing = variableDefinitionsById.get(variable);
      const inferredValueType = categoricalVariables.has(variable)
        ? 'categorical'
        : existing?.valueType ?? null;
      const sourceIds = sourceIdsByVariable.get(variable) ?? existing?.sourceIds;

      return {
        id: variable,
        name: existing?.name ?? variableDisplayNameById.get(variable) ?? variable,
        units: existing?.units ?? variableUnitsById.get(variable) ?? null,
        description: existing?.description ?? null,
        valueType: inferredValueType ?? variableTypeById.get(variable) ?? null,
        domain: existing?.domain ?? domainByVariable.get(variable) ?? null,
        category: existing?.category ?? categoryByVariable.get(variable) ?? null,
        group: existing?.group ?? groupByVariable.get(variable) ?? null,
        groupLabel: existing?.groupLabel ?? groupLabelByVariable.get(variable) ?? null,
        ...(sourceIds?.length ? { sourceIds } : {}),
      };
    });

  const normalizedBundle: UploadedParquetBundle = {
    categoricalStats,
    categoricalValueLookup,
    densityGraph,
    occurrences,
    occurrenceIndex,
    summaryStats,
    variableDefinitions: normalizedVariableDefinitions,
    dataSources: rawBundle.dataSources,
    locations: rawBundle.locations,
    meta: {
      source: 'upload-local',
      uploadedAt: rawBundle.meta?.uploadedAt ?? new Date(0).toISOString(),
      ...(categoricalValueWarnings.size > 0
        ? { warnings: Array.from(categoricalValueWarnings) }
        : {}),
    },
  };

  validateUploadedParquetBundle(normalizedBundle);
  return normalizedBundle;
};
