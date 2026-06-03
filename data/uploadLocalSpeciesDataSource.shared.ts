// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type {
  RawVariableMetadataRow,
  UploadedCategoricalValueLookupRow,
} from '@/data/uploadLocalSpeciesDataSource.types';

const CATEGORICAL_AGGREGATE_METRICS = new Set([
  'total_samples',
  'unique_samples',
  'unique_classes',
  'significant_unique_classes',
  'entropy',
  'mode',
]);

export const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const toStringValue = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

export const parseNumericArrayFromUnknown = (value: unknown): number[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => toFiniteNumber(entry))
      .filter((entry): entry is number => entry !== null);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const matches = value.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? [];
  return matches
    .map((entry) => toFiniteNumber(entry))
    .filter((entry): entry is number => entry !== null);
};

export const isCategoricalAggregateMetric = (metric: string) =>
  CATEGORICAL_AGGREGATE_METRICS.has(metric.trim().toLowerCase());

const normalizeCategoryMetricMatchKey = (value: string) => value.trim().toLowerCase();

const buildCategoryLookupCodeCandidates = (rawValue: number | string) => {
  const rawString = String(rawValue).trim();
  const numericValue = typeof rawValue === 'number' ? rawValue : toFiniteNumber(rawValue);
  const candidates = new Set<string>([rawString]);

  if (numericValue !== null && Number.isFinite(numericValue)) {
    candidates.add(String(Math.trunc(numericValue)));
    candidates.add(String(numericValue));
  }

  return Array.from(candidates);
};

export const resolveCategoryMetricValue = (
  variable: string,
  rawValue: number | string,
  categoryValueLookupByVariable?: Record<string, UploadedCategoricalValueLookupRow[]>,
): string => {
  const lookupRows = categoryValueLookupByVariable?.[variable] ?? [];
  if (lookupRows.length) {
    const lookupMap = new Map(
      lookupRows.map((row) => [normalizeCategoryMetricMatchKey(row.code), row.metric]),
    );

    for (const candidate of buildCategoryLookupCodeCandidates(rawValue)) {
      const matched = lookupMap.get(normalizeCategoryMetricMatchKey(candidate));
      if (matched) {
        return matched;
      }
    }
  }

  return String(rawValue).trim();
};

export const parseOccurrenceIndexCell = (
  value: unknown,
): { catalogNumber: string; value: number | string } | null => {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const cell = value as Record<string, unknown>;
    const catalogNumber = toStringValue(cell.catalogNumber);
    if (!catalogNumber) {
      return null;
    }
    const numericValue = toFiniteNumber(cell.value);
    const parsedValue = numericValue ?? (typeof cell.value === 'string' ? cell.value : null);
    if (parsedValue === null) {
      return null;
    }
    return { catalogNumber, value: parsedValue };
  }

  if (typeof value !== 'string') {
    return null;
  }

  const cell = value.trim();
  if (!cell.length || cell === 'nan' || cell === 'None') {
    return null;
  }

  const catalogMatch = cell.match(/[\'\"]catalogNumber[\'\"]\s*:\s*[\'\"]([^\'\"]+)[\'\"]/i);
  if (!catalogMatch?.[1]) {
    return null;
  }

  const rawValueMatch = cell.match(/[\'\"]value[\'\"]\s*:\s*([^,}\]]+)/i);
  const rawValue = rawValueMatch?.[1]?.trim();
  if (!rawValue) {
    return null;
  }

  const quotedValueMatch = rawValue.match(/^[\'\"](.+)[\'\"]$/);
  const normalizedRawValue = quotedValueMatch ? quotedValueMatch[1] : rawValue;
  const numericValue = toFiniteNumber(normalizedRawValue);
  const parsedValue = numericValue ?? normalizedRawValue;

  return {
    catalogNumber: catalogMatch[1],
    value: parsedValue,
  };
};

export const getVariableMetadataId = (row: RawVariableMetadataRow): string | null => {
  return (
    toStringValue(row.id)
    ?? toStringValue(row.variable)
  );
};

export const getVariableMetadataDisplayName = (row: RawVariableMetadataRow): string | null => {
  return (
    toStringValue(row.name)
    ?? toStringValue(row.exportedName)
    ?? toStringValue(row.exported_name)
    ?? toStringValue(row.variable)
    ?? toStringValue(row.id)
  );
};

export const getVariableMetadataValueType = (row: RawVariableMetadataRow): string | null => {
  return toStringValue(row.valueType) ?? toStringValue(row.value_type);
};
