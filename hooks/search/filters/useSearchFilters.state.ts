import type { SelectOption } from '@/components';
import type {
  EnvironmentVariableDefinition,
  SpeciesSummary,
} from '@/data/types';
import { DEFAULT_QUANTITY } from './useSearchFilters.helpers';

export type SearchFilterLocationInitialState = {
  countryValue?: string;
  stateValue?: string;
  countyValue?: string;
  countryOptions?: SelectOption[];
  stateOptions?: SelectOption[];
  countyOptions?: SelectOption[];
};

export type SearchFilterTaxonInitialState = {
  ancestorTaxonId?: number | null;
  baseTaxonQuery?: string;
};

export type SearchFilterRankingInitialState = {
  rankValue?: string;
  includeSubspecies?: boolean;
  sortVariableValue?: string;
  sortMetricValue?: string;
  sortOrder?: 'ascending' | 'descending';
  sortReference?: number;
  /** R̄ threshold (0.00–1.00). */
  minRbar?: number;
};

export type SearchFilterQuantityInitialState = {
  numberOfResults?: number;
  minimumSamples?: number;
};

export type UseSearchFiltersInitialState = {
  location?: SearchFilterLocationInitialState;
  taxon?: SearchFilterTaxonInitialState;
  ranking?: SearchFilterRankingInitialState;
  quantity?: SearchFilterQuantityInitialState;
};

export type SearchFiltersState = {
  countryValue: string;
  stateValue: string;
  countyValue: string;
  countryOptions: SelectOption[];
  stateOptions: SelectOption[];
  countyOptions: SelectOption[];
  countryLoading: boolean;
  stateLoading: boolean;
  countyLoading: boolean;
  ancestorTaxonId: number | null;
  baseTaxonQuery: string;
  baseTaxonFocused: boolean;
  baseTaxonSuggestions: SpeciesSummary[];
  baseTaxonSuggestionsLoading: boolean;
  baseTaxonSuggestionsVisible: boolean;
  rankValue: string;
  includeSubspecies: boolean;
  sortVariableValue: string;
  sortVariableOptions: SelectOption[];
  defaultSortVariableOptions: SelectOption[];
  sortVariableDefinitions: EnvironmentVariableDefinition[];
  rankingSortOptions: {
    variable: string;
    metric: string;
    label: string;
    column: string;
    count: number;
  }[];
  sortVariableLoading: boolean;
  sortMetricValue: string;
  sortOrder: 'ascending' | 'descending';
  sortReference: number;
  minRbar: number;
  numberOfResults: number;
  minimumSamples: number;
  debouncedQuantity: typeof DEFAULT_QUANTITY;
};

export type SearchFiltersAction =
  | { type: 'set-country-loading'; value: boolean }
  | { type: 'set-country-options'; options: SelectOption[] }
  | { type: 'change-country'; value: string }
  | { type: 'set-state-loading'; value: boolean }
  | { type: 'set-state-options'; options: SelectOption[] }
  | { type: 'change-state'; value: string }
  | { type: 'set-county-loading'; value: boolean }
  | { type: 'set-county-options'; options: SelectOption[] }
  | { type: 'change-county'; value: string }
  | { type: 'reset-location' }
  | { type: 'set-base-taxon-query'; value: string; showSuggestions: boolean }
  | { type: 'set-base-taxon-focus'; value: boolean }
  | { type: 'set-base-taxon-suggestions'; suggestions: SpeciesSummary[] }
  | { type: 'set-base-taxon-suggestions-loading'; value: boolean }
  | { type: 'set-base-taxon-suggestions-visible'; value: boolean }
  | { type: 'submit-base-taxon-result'; ancestorTaxonId: number | null }
  | { type: 'select-base-taxon'; query: string; ancestorTaxonId: number }
  | {
      type: 'hydrate-route-state';
      initialState?: UseSearchFiltersInitialState;
    }
  | {
      type: 'hydrate-route-location';
      initialState?: SearchFilterLocationInitialState;
    }
  | { type: 'reset-taxon' }
  | { type: 'set-rank'; value: string }
  | { type: 'set-include-subspecies'; value: boolean }
  | { type: 'set-sort-variable'; value: string }
  | { type: 'set-sort-variable-options'; options: SelectOption[] }
  | { type: 'set-default-sort-variable-options'; options: SelectOption[] }
  | {
      type: 'set-sort-variable-definitions';
      definitions: EnvironmentVariableDefinition[];
    }
  | {
      type: 'set-ranking-sort-options';
      options: {
        variable: string;
        metric: string;
        label: string;
        column: string;
        count: number;
      }[];
    }
  | { type: 'set-sort-variable-loading'; value: boolean }
  | { type: 'set-sort-metric'; value: string }
  | { type: 'set-sort-order'; value: 'ascending' | 'descending' }
  | { type: 'set-sort-reference'; value: number }
  | { type: 'set-min-rbar'; value: number }
  | { type: 'reset-ranking' }
  | { type: 'set-number-of-results'; value: number }
  | { type: 'set-minimum-samples'; value: number }
  | { type: 'set-debounced-quantity'; value: typeof DEFAULT_QUANTITY }
  | { type: 'reset-quantity' }
  | { type: 'reset-all' };

export const createInitialSearchFiltersState = (
  initialState?: UseSearchFiltersInitialState,
): SearchFiltersState => {
  const initialRankValue = initialState?.ranking?.rankValue ?? '';
  const initialQuantity = {
    numberOfResults:
      initialState?.quantity?.numberOfResults ??
      DEFAULT_QUANTITY.numberOfResults,
    minimumSamples:
      initialState?.quantity?.minimumSamples ?? DEFAULT_QUANTITY.minimumSamples,
  };

  return {
    countryValue: initialState?.location?.countryValue ?? '',
    stateValue: initialState?.location?.stateValue ?? '',
    countyValue: initialState?.location?.countyValue ?? '',
    countryOptions: initialState?.location?.countryOptions ?? [],
    stateOptions: initialState?.location?.stateOptions ?? [],
    countyOptions: initialState?.location?.countyOptions ?? [],
    countryLoading: false,
    stateLoading: false,
    countyLoading: false,
    ancestorTaxonId: initialState?.taxon?.ancestorTaxonId ?? null,
    baseTaxonQuery: initialState?.taxon?.baseTaxonQuery ?? '',
    baseTaxonFocused: false,
    baseTaxonSuggestions: [],
    baseTaxonSuggestionsLoading: false,
    baseTaxonSuggestionsVisible: false,
    rankValue: initialRankValue,
    includeSubspecies:
      initialRankValue === 'species'
        ? (initialState?.ranking?.includeSubspecies ?? true)
        : true,
    sortVariableValue: initialState?.ranking?.sortVariableValue ?? '',
    sortVariableOptions: [],
    defaultSortVariableOptions: [],
    sortVariableDefinitions: [],
    rankingSortOptions: [],
    sortVariableLoading: false,
    sortMetricValue: initialState?.ranking?.sortMetricValue ?? '',
    sortOrder: initialState?.ranking?.sortOrder ?? 'ascending',
    sortReference: initialState?.ranking?.sortReference ?? 0,
    minRbar: initialState?.ranking?.minRbar ?? 0.15,
    numberOfResults: initialQuantity.numberOfResults,
    minimumSamples: initialQuantity.minimumSamples,
    debouncedQuantity: initialQuantity,
  };
};

const areOptionsEqual = (left: SelectOption[], right: SelectOption[]) => {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every(
    (option, index) =>
      option.label === right[index]?.label &&
      option.value === right[index]?.value,
  );
};

const resolveHydratedLocationOptions = (
  state: SearchFiltersState,
  normalizedState: SearchFiltersState,
) => {
  const countryOptions =
    normalizedState.countryOptions.length > 0
      ? normalizedState.countryOptions
      : normalizedState.countryValue === state.countryValue
        ? state.countryOptions
        : [];
  const stateOptions =
    normalizedState.stateOptions.length > 0
      ? normalizedState.stateOptions
      : normalizedState.stateValue === state.stateValue
        ? state.stateOptions
        : [];
  const countyOptions =
    normalizedState.countyOptions.length > 0
      ? normalizedState.countyOptions
      : normalizedState.countyValue === state.countyValue
        ? state.countyOptions
        : [];

  return {
    countryOptions,
    stateOptions,
    countyOptions,
  };
};

const hasMatchingHydratedLocationState = (
  state: SearchFiltersState,
  normalizedState: SearchFiltersState,
  nextOptions: ReturnType<typeof resolveHydratedLocationOptions>,
) => {
  return (
    state.countryValue === normalizedState.countryValue &&
    state.stateValue === normalizedState.stateValue &&
    state.countyValue === normalizedState.countyValue &&
    areOptionsEqual(state.countryOptions, nextOptions.countryOptions) &&
    areOptionsEqual(state.stateOptions, nextOptions.stateOptions) &&
    areOptionsEqual(state.countyOptions, nextOptions.countyOptions)
  );
};

export const searchFiltersReducer = (
  state: SearchFiltersState,
  action: SearchFiltersAction,
): SearchFiltersState => {
  switch (action.type) {
    case 'set-country-loading':
      return { ...state, countryLoading: action.value };
    case 'set-country-options':
      return { ...state, countryOptions: action.options };
    case 'change-country':
      return {
        ...state,
        countryValue: action.value,
        stateValue: '',
        countyValue: '',
        stateOptions: [],
        countyOptions: [],
        stateLoading: false,
        countyLoading: false,
      };
    case 'set-state-loading':
      return { ...state, stateLoading: action.value };
    case 'set-state-options':
      return { ...state, stateOptions: action.options };
    case 'change-state':
      return {
        ...state,
        stateValue: action.value,
        countyValue: '',
        countyOptions: [],
        countyLoading: false,
      };
    case 'set-county-loading':
      return { ...state, countyLoading: action.value };
    case 'set-county-options':
      return { ...state, countyOptions: action.options };
    case 'change-county':
      return { ...state, countyValue: action.value };
    case 'reset-location':
      return {
        ...state,
        countryValue: '',
        stateValue: '',
        countyValue: '',
        stateOptions: [],
        countyOptions: [],
        stateLoading: false,
        countyLoading: false,
      };
    case 'set-base-taxon-query':
      return {
        ...state,
        baseTaxonQuery: action.value,
        ancestorTaxonId: null,
        baseTaxonSuggestionsVisible: action.showSuggestions,
      };
    case 'set-base-taxon-focus':
      return { ...state, baseTaxonFocused: action.value };
    case 'set-base-taxon-suggestions':
      return { ...state, baseTaxonSuggestions: action.suggestions };
    case 'set-base-taxon-suggestions-loading':
      return { ...state, baseTaxonSuggestionsLoading: action.value };
    case 'set-base-taxon-suggestions-visible':
      return { ...state, baseTaxonSuggestionsVisible: action.value };
    case 'submit-base-taxon-result':
      return { ...state, ancestorTaxonId: action.ancestorTaxonId };
    case 'select-base-taxon':
      return {
        ...state,
        baseTaxonQuery: action.query,
        ancestorTaxonId: action.ancestorTaxonId,
        baseTaxonFocused: false,
        baseTaxonSuggestionsVisible: false,
      };
    case 'hydrate-route-state': {
      const normalizedState = createInitialSearchFiltersState(
        action.initialState,
      );
      const hasBaseTaxon = normalizedState.ancestorTaxonId != null;
      const nextBaseTaxonQuery = (() => {
        if (!hasBaseTaxon) {
          return normalizedState.baseTaxonQuery;
        }

        const currentBaseTaxonLabel = state.baseTaxonQuery.trim();
        const currentRawTaxonId =
          state.ancestorTaxonId != null ? String(state.ancestorTaxonId) : '';
        const nextRawTaxonId = String(normalizedState.ancestorTaxonId);

        if (
          state.ancestorTaxonId === normalizedState.ancestorTaxonId &&
          currentBaseTaxonLabel.length > 0 &&
          currentBaseTaxonLabel !== currentRawTaxonId &&
          normalizedState.baseTaxonQuery === nextRawTaxonId
        ) {
          return state.baseTaxonQuery;
        }

        return normalizedState.baseTaxonQuery;
      })();
      const nextLocationOptions = resolveHydratedLocationOptions(
        state,
        normalizedState,
      );

      if (
        hasMatchingHydratedLocationState(
          state,
          normalizedState,
          nextLocationOptions,
        ) &&
        state.ancestorTaxonId === normalizedState.ancestorTaxonId &&
        state.baseTaxonQuery === nextBaseTaxonQuery &&
        state.rankValue === normalizedState.rankValue &&
        state.includeSubspecies ===
          (normalizedState.rankValue === 'species'
            ? normalizedState.includeSubspecies
            : true) &&
        state.sortVariableValue === normalizedState.sortVariableValue &&
        state.sortMetricValue === normalizedState.sortMetricValue &&
        state.sortOrder === normalizedState.sortOrder &&
        state.sortReference === normalizedState.sortReference &&
        state.minRbar === normalizedState.minRbar &&
        state.numberOfResults === normalizedState.numberOfResults &&
        state.minimumSamples === normalizedState.minimumSamples &&
        state.debouncedQuantity.numberOfResults ===
          normalizedState.debouncedQuantity.numberOfResults &&
        state.debouncedQuantity.minimumSamples ===
          normalizedState.debouncedQuantity.minimumSamples &&
        state.baseTaxonFocused === false &&
        state.baseTaxonSuggestions.length === 0 &&
        state.baseTaxonSuggestionsLoading === false &&
        state.baseTaxonSuggestionsVisible === false &&
        state.stateLoading === false &&
        state.countyLoading === false &&
        state.sortVariableLoading === false &&
        state.rankingSortOptions.length === 0 &&
        areOptionsEqual(
          state.sortVariableOptions,
          state.defaultSortVariableOptions,
        )
      ) {
        return state;
      }

      return {
        ...state,
        countryValue: normalizedState.countryValue,
        stateValue: normalizedState.stateValue,
        countyValue: normalizedState.countyValue,
        countryOptions: nextLocationOptions.countryOptions,
        stateOptions: nextLocationOptions.stateOptions,
        countyOptions: nextLocationOptions.countyOptions,
        stateLoading: false,
        countyLoading: false,
        ancestorTaxonId: normalizedState.ancestorTaxonId,
        baseTaxonQuery: nextBaseTaxonQuery,
        baseTaxonFocused: false,
        baseTaxonSuggestions: [],
        baseTaxonSuggestionsLoading: false,
        baseTaxonSuggestionsVisible: false,
        rankValue: normalizedState.rankValue,
        includeSubspecies:
          normalizedState.rankValue === 'species'
            ? normalizedState.includeSubspecies
            : true,
        sortVariableValue: normalizedState.sortVariableValue,
        sortVariableOptions: state.defaultSortVariableOptions,
        rankingSortOptions: [],
        sortVariableLoading: false,
        sortMetricValue: normalizedState.sortMetricValue,
        sortOrder: normalizedState.sortOrder,
        sortReference: normalizedState.sortReference,
        minRbar: normalizedState.minRbar,
        numberOfResults: normalizedState.numberOfResults,
        minimumSamples: normalizedState.minimumSamples,
        debouncedQuantity: normalizedState.debouncedQuantity,
      };
    }
    case 'hydrate-route-location': {
      const normalizedState = createInitialSearchFiltersState({
        location: action.initialState,
      });
      const nextLocationOptions = resolveHydratedLocationOptions(
        state,
        normalizedState,
      );

      if (
        hasMatchingHydratedLocationState(
          state,
          normalizedState,
          nextLocationOptions,
        ) &&
        state.stateLoading === false &&
        state.countyLoading === false
      ) {
        return state;
      }

      return {
        ...state,
        countryValue: normalizedState.countryValue,
        stateValue: normalizedState.stateValue,
        countyValue: normalizedState.countyValue,
        countryOptions: nextLocationOptions.countryOptions,
        stateOptions: nextLocationOptions.stateOptions,
        countyOptions: nextLocationOptions.countyOptions,
        stateLoading: false,
        countyLoading: false,
      };
    }
    case 'reset-taxon':
      return {
        ...state,
        ancestorTaxonId: null,
        baseTaxonQuery: '',
        baseTaxonFocused: false,
        baseTaxonSuggestions: [],
        baseTaxonSuggestionsLoading: false,
        baseTaxonSuggestionsVisible: false,
      };
    case 'set-rank':
      return {
        ...state,
        rankValue: action.value,
        includeSubspecies:
          action.value === 'species' ? state.includeSubspecies : true,
      };
    case 'set-include-subspecies':
      return { ...state, includeSubspecies: action.value };
    case 'set-sort-variable':
      return { ...state, sortVariableValue: action.value };
    case 'set-sort-variable-options':
      return { ...state, sortVariableOptions: action.options };
    case 'set-default-sort-variable-options':
      return { ...state, defaultSortVariableOptions: action.options };
    case 'set-sort-variable-definitions':
      return { ...state, sortVariableDefinitions: action.definitions };
    case 'set-ranking-sort-options':
      return { ...state, rankingSortOptions: action.options };
    case 'set-sort-variable-loading':
      return { ...state, sortVariableLoading: action.value };
    case 'set-sort-metric':
      return { ...state, sortMetricValue: action.value };
    case 'set-sort-order':
      return { ...state, sortOrder: action.value };
    case 'set-sort-reference':
      return { ...state, sortReference: action.value };
    case 'set-min-rbar':
      return { ...state, minRbar: action.value };
    case 'reset-ranking':
      return {
        ...state,
        rankValue: '',
        includeSubspecies: true,
        sortVariableValue: '',
        sortMetricValue: '',
        sortOrder: 'ascending',
        sortReference: 0,
        minRbar: 0.15,
        sortVariableLoading: false,
      };
    case 'set-number-of-results':
      return { ...state, numberOfResults: action.value };
    case 'set-minimum-samples':
      return { ...state, minimumSamples: action.value };
    case 'set-debounced-quantity':
      return { ...state, debouncedQuantity: action.value };
    case 'reset-quantity':
      return {
        ...state,
        numberOfResults: DEFAULT_QUANTITY.numberOfResults,
        minimumSamples: DEFAULT_QUANTITY.minimumSamples,
        debouncedQuantity: DEFAULT_QUANTITY,
      };
    case 'reset-all':
      return {
        ...state,
        countryValue: '',
        stateValue: '',
        countyValue: '',
        stateOptions: [],
        countyOptions: [],
        stateLoading: false,
        countyLoading: false,
        ancestorTaxonId: null,
        baseTaxonQuery: '',
        baseTaxonFocused: false,
        baseTaxonSuggestions: [],
        baseTaxonSuggestionsLoading: false,
        baseTaxonSuggestionsVisible: false,
        rankValue: '',
        includeSubspecies: true,
        sortVariableValue: '',
        sortMetricValue: '',
        sortOrder: 'ascending',
        sortReference: 0,
        minRbar: 0.15,
        sortVariableLoading: false,
        numberOfResults: DEFAULT_QUANTITY.numberOfResults,
        minimumSamples: DEFAULT_QUANTITY.minimumSamples,
        debouncedQuantity: DEFAULT_QUANTITY,
      };
    default:
      return state;
  }
};
