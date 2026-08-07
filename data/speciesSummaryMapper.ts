// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SpeciesApiNormalized, SpeciesSummary } from './types';

/** Safely narrows unknown values to object records for optional raw-field access. */
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

/** Normalizes names by replacing underscores with spaces when present. */
const normalizeName = (value?: string) =>
  typeof value === 'string' && value.length > 0 ? value.replace(/_/g, ' ') : value;

export type MapSpeciesSummaryOptions = {
  fallbackDescription?: string;
  includeRawDescription?: boolean;
};

/** Maps normalized species API entries to UI-ready `SpeciesSummary` records. */
export const mapSpeciesApiNormalizedToSummary = (
  entry: SpeciesApiNormalized,
  options: MapSpeciesSummaryOptions = {},
): SpeciesSummary | null => {
  const rawId = entry.taxon_id;
  if (!rawId) {
    return null;
  }

  const scientificName =
    (typeof entry.scientific_name === 'string' && entry.scientific_name.length > 0)
      ? entry.scientific_name
      : `Taxon #${rawId}`;

  const commonName = normalizeName(entry.common_name) ?? scientificName;
  const normalizedScientificName = normalizeName(scientificName);

  const includeRawDescription = options.includeRawDescription ?? true;
  const rawDescription = includeRawDescription
    ? asRecord(entry._raw).description
    : undefined;
  const description =
    (typeof rawDescription === 'string' && rawDescription.length > 0)
      ? rawDescription
      : (options.fallbackDescription ?? 'Tap to view species details');

  return {
    taxonId: rawId,
    commonName,
    commonNames: [commonName],
    scientificName: normalizedScientificName ?? '',
    description,
    imageSource: typeof entry.image_source === 'string' ? { uri: entry.image_source } : undefined,
  };
};
