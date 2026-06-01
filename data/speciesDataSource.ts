import {
  fetchEnvironmentRangeSlice,
  fetchEnvironmentVariables,
  fetchSpeciesEnvironment,
  fetchSpeciesEnvironmentCategorySamples,
  fetchSpeciesLocations,
  fetchSpeciesOccurrences,
} from './api';
import type {
  EnvironmentSliceParams,
  EnvironmentVariableDefinition,
  SpeciesEnvironmentCategorySampleResponse,
  SpeciesEnvironmentSliceResponse,
  SpeciesEnvironmentStats,
  SpeciesOccurrencesResult,
  LocationSearchResult,
} from './types';

type EnvironmentRequestOptions = {
  location?: string | null;
  units?: string | null;
  phenology?: string | null;
  startTs?: number | null;
  endTs?: number | null;
};

type CategorySampleOptions = EnvironmentRequestOptions & {
  limit?: number;
};

type FetchSpeciesLocationsLevel = 'continent' | 'country' | 'state' | 'county' | number;
type LocationParentIdentityMode = 'name' | 'gid';

export type SpeciesDataSource = {
  locationParentIdentityMode?: LocationParentIdentityMode;
  fetchEnvironmentVariables: (options?: { units?: string | null }) => Promise<EnvironmentVariableDefinition[]>;
  fetchSpeciesEnvironment: (
    taxonId: string | number,
    variableId: string,
    options?: EnvironmentRequestOptions,
  ) => Promise<SpeciesEnvironmentStats>;
  fetchEnvironmentRangeSlice: (
    params: EnvironmentSliceParams,
  ) => Promise<SpeciesEnvironmentSliceResponse>;
  fetchSpeciesEnvironmentCategorySamples: (
    taxonId: string | number,
    variableId: string,
    classValue: string | number,
    options?: CategorySampleOptions,
  ) => Promise<SpeciesEnvironmentCategorySampleResponse>;
  fetchObservationEnvironmentValue?: (
    taxonId: string | number,
    catalogNumber: string | number,
    variableId: string,
    options?: EnvironmentRequestOptions,
  ) => Promise<{
    variable: string;
    value: string | number | null;
    valueLabel?: string | null;
    valueDescription?: string | null;
    units?: string | null;
  }>;
  fetchSpeciesOccurrences: (
    taxonId: string | number,
    options?: EnvironmentRequestOptions,
  ) => Promise<SpeciesOccurrencesResult>;
  fetchSpeciesLocations: (
    taxonId: string | number,
    level?: FetchSpeciesLocationsLevel,
    parent?: string,
    limit?: number,
  ) => Promise<LocationSearchResult[]>;
};

export const remoteSpeciesDataSource: SpeciesDataSource = {
  locationParentIdentityMode: 'name',
  fetchEnvironmentVariables,
  fetchSpeciesEnvironment,
  fetchEnvironmentRangeSlice,
  fetchSpeciesEnvironmentCategorySamples,
  fetchSpeciesOccurrences,
  fetchSpeciesLocations,
};

export const createSpeciesDataSource = (
  overrides: Partial<SpeciesDataSource>,
): SpeciesDataSource => {
  return {
    ...remoteSpeciesDataSource,
    ...overrides,
  };
};
