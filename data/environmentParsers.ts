// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Compatibility export surface for environment response parsers.
 */
export {
  parseEnvironmentCategorySampleResponse,
  parseEnvironmentSliceResponse,
  parseSpeciesEnvironmentStats,
  normalizeObservationEntry,
  toFiniteNumber,
} from './parsers/environment/responses';

/**
 * Compatibility export for environment variable definition parsing.
 */
export { parseEnvironmentVariableDefinitions } from './parsers/environment/definitions';
