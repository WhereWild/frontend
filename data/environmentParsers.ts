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
