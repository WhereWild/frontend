/** Matches temporal variable IDs like `cloud_cover_avg_168h` or `weather_code_simple_mode_168h`. */
const TEMPORAL_PATTERN = /^(.+)_(avg|sum|mode|snapshot)_(\d+)h$/i;

export type ParsedTemporalId = {
  baseId: string;
  agg: string;
  windowHours: number;
};

export function parseTemporalId(id: string): ParsedTemporalId | null {
  const match = id.match(TEMPORAL_PATTERN);
  if (!match) return null;
  return {
    baseId: match[1],
    agg: match[2],
    windowHours: parseInt(match[3], 10),
  };
}

export function isTemporalId(id: string): boolean {
  return TEMPORAL_PATTERN.test(id);
}

/** Strips the trailing aggregate+window suffix from a temporal variable label.
 *  e.g. "Dew Point (2m) (Avg, 168h)" → "Dew Point (2m)" */
export function stripTemporalSuffix(label: string): string {
  return label.replace(/\s*\((avg|sum|mode|snapshot),\s*\d+h\)\s*$/i, '').trim();
}

const WINDOW_LABELS: Record<number, string> = {
  1: '1 hour',
  8: '8 hours',
  24: '1 day',
  72: '3 days',
  168: '1 week',
  720: '1 month',
  2160: '3 months',
};

export function formatWindowHours(hours: number): string {
  return WINDOW_LABELS[hours] ?? `${hours}h`;
}
