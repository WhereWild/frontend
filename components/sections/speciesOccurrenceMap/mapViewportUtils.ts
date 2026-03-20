export const MERCATOR_MAX_LAT = 85.05112878;
const BACKEND_MIN_LAT = -90;
const BACKEND_MAX_LAT = 90;
const BACKEND_MIN_LON = -180;
const BACKEND_MAX_LON = 180;
const BACKEND_MAX_RESOLUTION = 10;
const MIN_STRICT_SPAN = 1e-6;

export const clampResolution = (value: number, fallback = 0.25): number => {
  const numericFallback = Number(fallback);
  const safeFallback =
    Number.isFinite(numericFallback) && numericFallback > 0
      ? Math.min(numericFallback, BACKEND_MAX_RESOLUTION)
      : 0.25;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return safeFallback;
  }
  return Math.min(numeric, BACKEND_MAX_RESOLUTION);
};

export const clampMaxCells = (value: number, fallback = 20000): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(100, Math.min(2000000, Math.floor(numeric)));
};

export const clampLatitude = (value: number): number =>
  Math.max(-MERCATOR_MAX_LAT, Math.min(MERCATOR_MAX_LAT, Number(value)));

export const alignLongitudeToView = (value: number, anchorLongitude: number): number => {
  const numeric = Number(value);
  const anchor = Number(anchorLongitude);
  if (!Number.isFinite(numeric) || !Number.isFinite(anchor)) {
    return Number.NaN;
  }
  const worldOffset = Math.round((anchor - numeric) / 360);
  return numeric + worldOffset * 360;
};

export const wrapLongitudeCanonical = (value: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return Number.NaN;
  }
  let wrapped = ((numeric + 180) % 360 + 360) % 360 - 180;
  if (wrapped === -180 && numeric > 0) {
    wrapped = 180;
  }
  return wrapped;
};

export const canonicalizeRequestBounds = (
  south: number,
  west: number,
  north: number,
  east: number,
): { minLat: number; minLon: number; maxLat: number; maxLon: number } => {
  const southClamped = clampLatitude(south);
  const northClamped = clampLatitude(north);
  let minLat = Math.max(BACKEND_MIN_LAT, Math.min(BACKEND_MAX_LAT, southClamped));
  let maxLat = Math.max(BACKEND_MIN_LAT, Math.min(BACKEND_MAX_LAT, northClamped));

  if (minLat >= maxLat) {
    if (maxLat >= BACKEND_MAX_LAT) {
      minLat = BACKEND_MAX_LAT - MIN_STRICT_SPAN;
      maxLat = BACKEND_MAX_LAT;
    } else {
      maxLat = Math.min(BACKEND_MAX_LAT, minLat + MIN_STRICT_SPAN);
      minLat = Math.max(BACKEND_MIN_LAT, maxLat - MIN_STRICT_SPAN);
    }
  }
  const rawWest = Number(west);
  const rawEast = Number(east);
  const rawSpan = rawEast - rawWest;

  if (!Number.isFinite(rawWest) || !Number.isFinite(rawEast) || !Number.isFinite(rawSpan)) {
    return {
      minLat,
      maxLat,
      minLon: BACKEND_MIN_LON,
      maxLon: BACKEND_MAX_LON,
    };
  }

  let span = rawSpan;
  if (span < 0) {
    const worldShifts = Math.floor(Math.abs(span) / 360) + 1;
    span += worldShifts * 360;
  }

  if (span >= 360) {
    return {
      minLat,
      maxLat,
      minLon: BACKEND_MIN_LON,
      maxLon: BACKEND_MAX_LON,
    };
  }

  const minLon = wrapLongitudeCanonical(rawWest);
  const maxLon = minLon + span;

  if (
    !Number.isFinite(minLon)
    || !Number.isFinite(maxLon)
    || minLon < BACKEND_MIN_LON
    || maxLon > BACKEND_MAX_LON
    || minLon > maxLon
  ) {
    return {
      minLat,
      maxLat,
      minLon: BACKEND_MIN_LON,
      maxLon: BACKEND_MAX_LON,
    };
  }

  if (minLon === maxLon) {
    const widenedMaxLon = Math.min(BACKEND_MAX_LON, maxLon + MIN_STRICT_SPAN);
    const widenedMinLon = Math.max(BACKEND_MIN_LON, widenedMaxLon - MIN_STRICT_SPAN);
    return {
      minLat,
      maxLat,
      minLon: widenedMinLon,
      maxLon: widenedMaxLon,
    };
  }

  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
  };
};

export const currentWorldLongitudeWindow = (anchorLongitude: number): { west: number; east: number } => {
  const anchor = Number(anchorLongitude);
  const worldBase = Math.floor((anchor + 180) / 360) * 360;
  return {
    west: worldBase - 180,
    east: worldBase + 180,
  };
};