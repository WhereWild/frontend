import { BACKEND_BASE, fetchJsonOrThrow, asRecord } from './apiShared';

export type PointEnvironmentResult = {
  variable: string;
  units: string | null;
  lat: number;
  lon: number;
  value: number | null;
  /** Human-readable class name for categorical variables, null for continuous or unknown. */
  className: string | null;
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
  options?: { units?: string | null },
): Promise<PointEnvironmentResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    variable: variableId,
  });
  if (options?.units) {
    params.set('unit_system', options.units);
  }
  const payload = await fetchJsonOrThrow(
    `${BACKEND_BASE}/gis/point?${params.toString()}`,
    `Failed to fetch point value for ${variableId} at (${lat}, ${lon})`,
  );
  const source = asRecord(payload);
  return {
    variable: String(source.variable ?? variableId),
    units: typeof source.units === 'string' ? source.units : null,
    lat: typeof source.lat === 'number' ? source.lat : lat,
    lon: typeof source.lon === 'number' ? source.lon : lon,
    value: typeof source.value === 'number' ? source.value : null,
    className: typeof source.class_name === 'string' ? source.class_name : null,
  };
}