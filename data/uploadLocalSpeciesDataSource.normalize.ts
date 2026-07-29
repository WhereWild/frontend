// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EnvironmentVariableDefinition, LegendClass, LocationSearchResult } from '@/data/types';
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
  type UploadedDensityGridRow,
  type UploadedOccurrenceIndexRow,
  type UploadedOccurrenceRow,
  type UploadedParquetBundle,
  type UploadedSummaryStatsRow,
  UploadedParquetBundleValidationError,
} from '@/data/uploadLocalSpeciesDataSource.types';

const COMPOSITION_AXES = new Set(['top', 'bottom_left', 'bottom_right']);

const getCompositionGroup = (row: { composition_group?: unknown; compositionGroup?: unknown }) =>
  toStringValue(row.composition_group) ?? toStringValue(row.compositionGroup);

const getCompositionAxis = (
  row: { composition_axis?: unknown; compositionAxis?: unknown },
): 'top' | 'bottom_left' | 'bottom_right' | null => {
  const raw = toStringValue(row.composition_axis) ?? toStringValue(row.compositionAxis);
  return raw && COMPOSITION_AXES.has(raw) ? (raw as 'top' | 'bottom_left' | 'bottom_right') : null;
};

const getCompositionLabel = (row: { composition_label?: unknown; compositionLabel?: unknown }) =>
  toStringValue(row.composition_label) ?? toStringValue(row.compositionLabel);

export const validateUploadedParquetBundle = (
  bundle: UploadedParquetBundle,
): void => {
  const issues: string[] = [];

  if (!bundle.summaryStats.length) {
    issues.push('summary_stats did not produce any valid rows');
  }

  if (!bundle.occurrences.length) {
    issues.push('occurrence did not produce any valid rows');
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

  // {groupId: {axis: columnId}} — mirrors util.ternary.composition_group_members.
  // Only columns tagged with both composition_group and composition_axis are
  // members; a group is only usable once all 3 axes are present.
  const compositionAxisByGroup: Record<
    string,
    Partial<Record<'top' | 'bottom_left' | 'bottom_right', string>>
  > = {};
  rawBundle.variableMetadata?.forEach((row) => {
    const canonicalId = getVariableMetadataId(row);
    const group = getCompositionGroup(row);
    const axis = getCompositionAxis(row);
    if (!canonicalId || !group || !axis) {
      return;
    }
    compositionAxisByGroup[group] = compositionAxisByGroup[group] ?? {};
    compositionAxisByGroup[group][axis] = canonicalId;
  });
  const compositionGroupMembers: Record<string, [string, string, string]> = {};
  Object.entries(compositionAxisByGroup).forEach(([group, axes]) => {
    if (axes.top && axes.bottom_left && axes.bottom_right) {
      compositionGroupMembers[group] = [axes.top, axes.bottom_left, axes.bottom_right];
    }
  });
  const compositionAxisColumnIds = new Set(
    Object.values(compositionGroupMembers).flat(),
  );

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

  const ordinalStats = (rawBundle.ordinalStats ?? [])
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
      assignValueType(variable, 'ordinal');
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

  const densityGraph = rawBundle.densityGraph.flatMap(
    (row): UploadedDensityGraphPoint[] => {
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
    },
  );

  const densityGrid: UploadedDensityGridRow[] = (rawBundle.densityGrid ?? []).flatMap(
    (row): UploadedDensityGridRow[] => {
      const variable = toStringValue(row.variable);
      const resolution = toFiniteNumber(row.resolution);
      const density = parseNumericArrayFromUnknown(row.density);
      if (!variable || resolution === null || density.length === 0) {
        return [];
      }
      const classIds = parseNumericArrayFromUnknown(row.class_ids);
      const classBoundaryA = parseNumericArrayFromUnknown(row.class_boundary_a);
      const classBoundaryB = parseNumericArrayFromUnknown(row.class_boundary_b);
      return [{
        variable,
        resolution,
        density,
        sampleA: parseNumericArrayFromUnknown(row.sample_a),
        sampleB: parseNumericArrayFromUnknown(row.sample_b),
        sampleC: parseNumericArrayFromUnknown(row.sample_c),
        classIds: classIds.length > 0 ? classIds : null,
        classBoundaryA: classBoundaryA.length > 0 ? classBoundaryA : null,
        classBoundaryB: classBoundaryB.length > 0 ? classBoundaryB : null,
      }];
    },
  );

  const occurrences = rawBundle.occurrences
    .map((row): UploadedOccurrenceRow | null => {
      const catalogNumber = toStringValue(row.catalogNumber);
      const latitude = toFiniteNumber(row.decimalLatitude);
      const longitude = toFiniteNumber(row.decimalLongitude);

      if (!catalogNumber || latitude === null || longitude === null) {
        return null;
      }

      let compositionValues: Record<string, number> | undefined;
      if (compositionAxisColumnIds.size > 0) {
        compositionAxisColumnIds.forEach((columnId) => {
          const value = toFiniteNumber(row[columnId]);
          if (value === null) {
            return;
          }
          compositionValues = compositionValues ?? {};
          compositionValues[columnId] = value;
        });
      }

      return {
        catalogNumber,
        latitude,
        longitude,
        locationGid: toStringValue(row.locationGid),
        catalogName: toStringValue(row.observationName),
        catalogAutoGenerated: row._catalogAutoGenerated === true,
        ...(compositionValues ? { compositionValues } : {}),
      };
    })
    .filter((row): row is UploadedOccurrenceRow => row !== null);

  const categoryMetricsByVariable = [...categoricalStats, ...ordinalStats].reduce<
    Record<string, string[]>
  >((acc, row) => {
    if (isCategoricalAggregateMetric(row.metric)) {
      return acc;
    }
    if (!row.metric.startsWith('class_')) {
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
  rawBundle.occurrences.forEach((row) => {
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
        const matchedMetric = categoryMetricsByVariable[
          canonicalVariable
        ]?.some(
          (metric) => metric.trim().toLowerCase() === normalizedClassValue,
        );

        if (!matchedMetric) {
          const variableLabel =
            variableDisplayNameById.get(canonicalVariable) ?? canonicalVariable;
          categoricalValueWarnings.add(
            `Uploaded categorical variable "${variableLabel}" has occurrence_index codes that do not resolve through categorical_value_lookup, so categorical highlighting may be unavailable.`,
          );
          // Unresolvable code — don't fabricate a class row for it. Leaving
          // this observation out of occurrenceIndex for this variable makes
          // it read as no-data downstream, instead of masquerading as a real
          // (uncolored) category value.
          return;
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

  const summaryStats = [
    ...rawBundle.summaryStats,
    ...(rawBundle.circularStats ?? []),
  ]
    .map((row): UploadedSummaryStatsRow | null => {
      const variable = toStringValue(row.variable);
      const variableCategory = toStringValue(row.variableCategory);
      const variableName =
        toStringValue(row.variableName) ?? toStringValue(row.variable_name);
      const units = toStringValue(row.units);
      const variableType =
        toStringValue(row.variableType) ??
        toStringValue(row.variable_type) ??
        toStringValue(row.valueType) ??
        toStringValue(row.value_type);
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
        median: toFiniteNumber(row.median),
        std: toFiniteNumber(row.std),
        stddev: toFiniteNumber(row.std),
        variance: toFiniteNumber(row.variance),
        range: toFiniteNumber(row.range),
        q10: toFiniteNumber(row['10th percentile'] ?? row['10th_percentile']),
        q25: toFiniteNumber(row['25th percentile'] ?? row['25th_percentile']),
        q75: toFiniteNumber(row['75th percentile'] ?? row['75th_percentile']),
        q90: toFiniteNumber(row['90th percentile'] ?? row['90th_percentile']),
        iqr: toFiniteNumber(row.iqr),
        q10_90_range: toFiniteNumber(row['10_90_range']),
        circular_mean: toFiniteNumber(row.circular_mean),
        rbar: toFiniteNumber(row.rbar),
        circular_std: toFiniteNumber(row.circular_std),
        circular_var: toFiniteNumber(row.circular_var),
        entropy: toFiniteNumber(row.entropy),
        mode: toFiniteNumber(row.mode),
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

  categoricalStats.forEach((row) =>
    assignCategory(row.variable, row.variableCategory),
  );
  categoricalValueLookup.forEach((row) =>
    assignCategory(row.variable, row.variableCategory),
  );
  densityGraph.forEach((row) =>
    assignCategory(row.variable, row.variableCategory),
  );
  summaryStats.forEach((row) =>
    assignCategory(row.variable, row.variableCategory),
  );

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
    ...ordinalStats.map((row) => row.variable),
    ...categoricalValueLookup.map((row) => row.variable),
    ...densityGraph.map((row) => row.variable),
    ...occurrenceIndex.map((row) => row.variable),
    ...(rawBundle.variableMetadata ?? [])
      .map(getVariableMetadataId)
      .filter((value): value is string => Boolean(value)),
    ...(rawBundle.variableDefinitions ?? []).map((definition) => definition.id),
  ]);

  const variableDefinitionsById = new Map<
    string,
    EnvironmentVariableDefinition
  >();

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
        const parsed =
          typeof row.source_ids === 'string'
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

    let legendClasses: LegendClass[] | null = existing?.legendClasses ?? null;
    if (row.legend_classes != null && legendClasses == null) {
      try {
        const parsed =
          typeof row.legend_classes === 'string'
            ? JSON.parse(row.legend_classes)
            : row.legend_classes;
        if (Array.isArray(parsed)) {
          const items = parsed
            .filter(
              (c): c is Record<string, unknown> =>
                c != null && typeof c === 'object',
            )
            .map((c) => ({
              id: (typeof c.id === 'number' || typeof c.id === 'string'
                ? c.id
                : String(c.id)) as number | string,
              name: typeof c.name === 'string' ? c.name : String(c.id),
              color: typeof c.color === 'string' ? c.color : undefined,
            }));
          if (items.length > 0) legendClasses = items;
        }
      } catch {
        // malformed legend_classes — ignore
      }
    }

    const renderMin =
      (typeof row.render_min === 'number' ? row.render_min : null) ??
      existing?.renderMin ??
      null;
    const renderMax =
      (typeof row.render_max === 'number' ? row.render_max : null) ??
      existing?.renderMax ??
      null;

    variableDefinitionsById.set(variableId, {
      id: variableId,
      name:
        getVariableMetadataDisplayName(row) ??
        existing?.name ??
        variableDisplayNameById.get(variableId) ??
        variableId,
      units:
        toStringValue(row.units) ??
        existing?.units ??
        variableUnitsById.get(variableId) ??
        null,
      valueType:
        getVariableMetadataValueType(row) ??
        existing?.valueType ??
        variableTypeById.get(variableId) ??
        null,
      domain: toStringValue(row.domain) ?? existing?.domain ?? null,
      description: existing?.description ?? null,
      category:
        toStringValue(row.category) ??
        existing?.category ??
        categoryByVariable.get(variableId) ??
        null,
      renderMin,
      renderMax,
      legendClasses,
      compositionGroup: getCompositionGroup(row) ?? existing?.compositionGroup ?? null,
      compositionAxis: getCompositionAxis(row) ?? existing?.compositionAxis ?? null,
      compositionLabel: getCompositionLabel(row) ?? existing?.compositionLabel ?? null,
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
      const inferredValueType =
        existing?.valueType ??
        variableTypeById.get(variable) ??
        (categoricalVariables.has(variable) ? 'categorical' : null);
      const sourceIds =
        sourceIdsByVariable.get(variable) ?? existing?.sourceIds;

      return {
        id: variable,
        name:
          existing?.name ?? variableDisplayNameById.get(variable) ?? variable,
        units: existing?.units ?? variableUnitsById.get(variable) ?? null,
        description: existing?.description ?? null,
        valueType: inferredValueType,
        domain: existing?.domain ?? domainByVariable.get(variable) ?? null,
        category:
          existing?.category ?? categoryByVariable.get(variable) ?? null,
        group: existing?.group ?? groupByVariable.get(variable) ?? null,
        groupLabel:
          existing?.groupLabel ?? groupLabelByVariable.get(variable) ?? null,
        renderMin: existing?.renderMin ?? null,
        renderMax: existing?.renderMax ?? null,
        legendClasses: existing?.legendClasses ?? null,
        compositionGroup: existing?.compositionGroup ?? null,
        compositionAxis: existing?.compositionAxis ?? null,
        compositionLabel: existing?.compositionLabel ?? null,
        ...(sourceIds?.length ? { sourceIds } : {}),
      };
    });

  const locations: LocationSearchResult[] = (rawBundle.locations ?? [])
    .flatMap((row) => {
      const gid = toStringValue(row.gid);
      const name = toStringValue(row.name);
      const level = typeof row.level === 'number' ? row.level : parseInt(String(row.level ?? ''), 10);
      if (!gid || !name || !Number.isFinite(level)) return [];
      let hierarchy: string[] = [];
      if (Array.isArray(row.hierarchy)) {
        hierarchy = row.hierarchy.filter((v): v is string => typeof v === 'string');
      } else {
        try {
          const parsed = JSON.parse(String(row.hierarchy ?? '[]'));
          if (Array.isArray(parsed)) hierarchy = parsed.filter((v): v is string => typeof v === 'string');
        } catch {}
      }
      return [{ gid, name, level, hierarchy }];
    });

  const normalizedBundle: UploadedParquetBundle = {
    categoricalStats,
    ordinalStats,
    categoricalValueLookup,
    densityGraph,
    densityGrid,
    occurrences,
    occurrenceIndex,
    summaryStats,
    variableDefinitions: normalizedVariableDefinitions,
    dataSources: rawBundle.dataSources,
    locations: locations.length > 0 ? locations : undefined,
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
