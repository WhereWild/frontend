// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BACKEND_BASE, fetchJsonOrThrow, asRecord } from './apiShared';

export type PointEnvironmentResult = {
  variable: string;
  units: string | null;
  lat: number;
  lon: number;
  value: number | string | null;
  valueLabel: string | null;
  valueDescription: string | null;
};

/**
 * Returns the raster value for an environmental variable at a coordinate.
 * Returns null value when outside coverage or on a nodata pixel.
 * This is the shared primitive for both observation pinning and
 * arbitrary map-click lookups.
 */
export async function fetchPointEnvironmentValue(
  lat: number,
  lon: number,
  variableId: string,
  options?: { units?: string | null; taxonId?: string | number | null; catalogNumber?: string | number | null },
): Promise<PointEnvironmentResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    variable: variableId,
  });
  if (options?.units) {
    params.set('unit_system', options.units);
  }
  if (options?.taxonId != null) {
    params.set('taxon_id', String(options.taxonId));
  }
  if (options?.catalogNumber != null) {
    params.set('catalog_number', String(options.catalogNumber));
  }
  const payload = await fetchJsonOrThrow(
    `${BACKEND_BASE}/gis/point?${params.toString()}`,
    `Failed to fetch point value for ${variableId} at (${lat}, ${lon})`,
  );
  const source = asRecord(payload);
  const valueLabel =
    typeof source.valueLabel === 'string'
      ? source.valueLabel
      : typeof source.value_label === 'string'
        ? source.value_label
        : typeof source.className === 'string'
          ? source.className
          : typeof source.class_name === 'string'
            ? source.class_name
          : typeof source.label === 'string'
              ? source.label
              : null;
  const value =
    typeof source.value === 'number' || typeof source.value === 'string'
      ? source.value
      : typeof source.classValue === 'number' || typeof source.classValue === 'string'
        ? source.classValue
        : typeof source.class_value === 'number' || typeof source.class_value === 'string'
          ? source.class_value
          : typeof source.categoryValue === 'number' || typeof source.categoryValue === 'string'
            ? source.categoryValue
            : typeof source.category_value === 'number' || typeof source.category_value === 'string'
              ? source.category_value
              : valueLabel;
  return {
    variable: String(source.variable ?? variableId),
    units: typeof source.units === 'string' ? source.units : null,
    lat: typeof source.lat === 'number' ? source.lat : lat,
    lon: typeof source.lon === 'number' ? source.lon : lon,
    value,
    valueLabel,
    valueDescription:
      typeof source.valueDescription === 'string'
        ? source.valueDescription
        : typeof source.value_description === 'string'
          ? source.value_description
          : typeof source.description === 'string'
            ? source.description
            : null,
  };
}
