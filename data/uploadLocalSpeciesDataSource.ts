// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

export { buildUploadLocalSpeciesDataSource } from '@/data/uploadLocalSpeciesDataSource.build';
export {
  normalizeRawUploadedParquetBundle,
  validateUploadedParquetBundle,
} from '@/data/uploadLocalSpeciesDataSource.normalize';
export {
  UploadedParquetBundleValidationError,
  type LocalSourceMeta,
  type RawCategoricalStatsRow,
  type RawCategoricalValueLookupRow,
  type RawDensityGraphRow,
  type RawOccurrenceIndexRow,
  type RawOccurrenceRow,
  type RawSummaryStatsRow,
  type RawUploadedParquetBundle,
  type RawVariableMetadataRow,
  type UploadedCategoricalStatsRow,
  type UploadedCategoricalValueLookupRow,
  type UploadedDensityGraphPoint,
  type UploadedOccurrenceIndexRow,
  type UploadedOccurrenceRow,
  type UploadedParquetBundle,
  type UploadedSummaryStatsRow,
} from '@/data/uploadLocalSpeciesDataSource.types';
