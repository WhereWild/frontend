import type { EnvironmentVariableDefinition } from '../../types';
import { asRecord } from '../core';

const toVariableDefinition = (entry: unknown): EnvironmentVariableDefinition => {
  const source = asRecord(entry);
  const rawSourceIds = source?.source_ids ?? source?.sourceIds;
  const sourceIds = Array.isArray(rawSourceIds)
    ? rawSourceIds.filter((v): v is string => typeof v === 'string')
    : undefined;
  return {
    id: String(source?.id ?? ''),
    name: typeof source?.name === 'string' ? source.name : undefined,
    units: typeof source?.units === 'string' ? source.units : null,
    description: typeof source?.description === 'string' ? source.description : undefined,
    valueType:
      typeof source?.value_type === 'string'
        ? source.value_type
        : typeof source?.valueType === 'string'
          ? source.valueType
          : null,
    category: typeof source?.category === 'string' ? source.category : null,
    sourceIds: sourceIds && sourceIds.length > 0 ? sourceIds : undefined,
  };
};

/**
 * Parses variable definition rows from backend payloads.
 */
export const parseEnvironmentVariableDefinitions = (payload: unknown): EnvironmentVariableDefinition[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map(toVariableDefinition).filter((entry) => entry.id.length > 0);
};