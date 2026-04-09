import type {
  EnvironmentVariableDefinition,
  LocationSearchResult,
} from '@/data/types';

export type LocalSourceMeta = {
  source: 'upload-local';
  uploadedAt: string;
  warnings?: string[];
};

export type RawRecord = Record<string, unknown>;

export type UploadedCategoricalStatsRow = {
  variable: string;
  variableCategory?: string | null;
  metric: string;
  metricLabel?: string | null;
  value: number;
};

export type UploadedCategoricalValueLookupRow = {
  variable: string;
  variableName?: string | null;
  variableCategory?: string | null;
  code: string;
  metric: string;
  label?: string | null;
  description?: string | null;
  group?: string | null;
  groupLabel?: string | null;
};

export type UploadedDensityGraphPoint = {
  variable: string;
  variableCategory?: string | null;
  value: number;
  density: number;
};

export type UploadedOccurrenceRow = {
  catalogNumber: number | string;
  latitude: number;
  longitude: number;
  locationGid?: string | null;
  catalogName?: string | null;
};

export type UploadedOccurrenceIndexRow = {
  variable: string;
  mode: 'range' | 'category';
  min?: number;
  max?: number;
  classValue?: number | string;
  observationIds: Array<number | string>;
};

export type UploadedSummaryStatsRow = {
  variable: string;
  variableCategory?: string | null;
  variableName?: string;
  units?: string | null;
  variableType?: string | null;
  count: number;
  min: number | null;
  mean: number | null;
  max: number | null;
  stddev?: number | null;
  q01?: number | null;
  q10?: number | null;
  q90?: number | null;
  q99?: number | null;
  bins?: number[];
  counts?: number[];
};

export type RawCategoricalStatsRow = {
  variable?: unknown;
  variableName?: unknown;
  variableCategory?: unknown;
  metric?: unknown;
  metricLabel?: unknown;
  value?: unknown;
};

export type RawDensityGraphRow = {
  variable?: unknown;
  variableName?: unknown;
  variableCategory?: unknown;
  points?: unknown;
  density?: unknown;
};

export type RawCategoricalValueLookupRow = {
  variable?: unknown;
  variableName?: unknown;
  variableCategory?: unknown;
  code?: unknown;
  metric?: unknown;
  label?: unknown;
  description?: unknown;
  group?: unknown;
  groupLabel?: unknown;
};

export type RawOccurrenceRow = {
  catalogNumber?: unknown;
  decimalLatitude?: unknown;
  decimalLongitude?: unknown;
  locationGid?: unknown;
  observationName?: unknown;
};

export type RawOccurrenceIndexRow = RawRecord;

export type RawSummaryStatsRow = {
  variable?: unknown;
  variableName?: unknown;
  variable_name?: unknown;
  variableCategory?: unknown;
  units?: unknown;
  variableType?: unknown;
  variable_type?: unknown;
  valueType?: unknown;
  value_type?: unknown;
  count?: unknown;
  min?: unknown;
  mean?: unknown;
  max?: unknown;
  std?: unknown;
  ['10th percentile']?: unknown;
  ['90th percentile']?: unknown;
};

export type RawVariableMetadataRow = {
  name?: unknown;
  exportedName?: unknown;
  exported_name?: unknown;
  variable?: unknown;
  id?: unknown;
  category?: unknown;
  units?: unknown;
  valueType?: unknown;
  value_type?: unknown;
};

export type RawUploadedParquetBundle = {
  categoricalStats: RawCategoricalStatsRow[];
  categoricalValueLookup?: RawCategoricalValueLookupRow[];
  densityGraph: RawDensityGraphRow[];
  occurrences: RawOccurrenceRow[];
  occurrenceIndex: RawOccurrenceIndexRow[];
  summaryStats: RawSummaryStatsRow[];
  variableMetadata?: RawVariableMetadataRow[];
  variableDefinitions?: EnvironmentVariableDefinition[];
  locations?: LocationSearchResult[];
  meta?: LocalSourceMeta;
};

export type UploadedParquetBundle = {
  categoricalStats: UploadedCategoricalStatsRow[];
  categoricalValueLookup?: UploadedCategoricalValueLookupRow[];
  densityGraph: UploadedDensityGraphPoint[];
  occurrences: UploadedOccurrenceRow[];
  occurrenceIndex: UploadedOccurrenceIndexRow[];
  summaryStats: UploadedSummaryStatsRow[];
  variableDefinitions?: EnvironmentVariableDefinition[];
  locations?: LocationSearchResult[];
  meta?: LocalSourceMeta;
};

export class UploadedParquetBundleValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super(`Uploaded parquet bundle is invalid: ${issues.join(' | ')}`);
    this.name = 'UploadedParquetBundleValidationError';
    this.issues = issues;
  }
}
