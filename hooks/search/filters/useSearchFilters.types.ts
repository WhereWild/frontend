import type { SearchTaxaQueryFilters } from '@/data/api';
import type { FiltersProps } from '@/components';
import type { SpeciesSummary } from '@/data/types';
import type { SelectOption } from '@/components';
import type {
  SearchFilterLocationInitialState,
  UseSearchFiltersInitialState,
} from './useSearchFilters.state';

export type SearchFiltersPanelProps = Omit<FiltersProps, 'style'>;

export type UseSearchFiltersResult = {
  panelProps: SearchFiltersPanelProps;

  // Location
  countryValue: string;
  countryOptions: SelectOption[];
  countryLoading: boolean;
  onCountryChange: (value: string) => void;
  stateValue: string;
  stateOptions: SelectOption[];
  stateLoading: boolean;
  onStateChange: (value: string) => void;
  countyValue: string;
  countyOptions: SelectOption[];
  countyLoading: boolean;
  onCountyChange: (value: string) => void;

  // Taxon
  baseTaxonQuery: string;
  onBaseTaxonQueryChange: (value: string) => void;
  onBaseTaxonSubmit: (value: string) => Promise<void>;
  onBaseTaxonFocus: () => void;
  onBaseTaxonBlur: () => void;
  onHydrateRouteState: (state?: UseSearchFiltersInitialState) => void;
  onHydrateRouteLocation: (state?: SearchFilterLocationInitialState) => void;
  rankValue: string;
  rankOptions: SelectOption[];
  onRankChange: (value: string) => void;
  includeSubspecies: boolean;
  onIncludeSubspeciesChange: (value: boolean) => void;
  baseTaxonSuggestions: SpeciesSummary[];
  baseTaxonSuggestionsLoading: boolean;
  baseTaxonSuggestionsVisible: boolean;
  onBaseTaxonSelect: (species: SpeciesSummary) => void;

  // Sort
  sortVariableValue: string;
  sortVariableOptions: SelectOption[];
  sortVariableLoading: boolean;
  sortVariableSourceIds: string[];
  onSortVariableChange: (value: string) => void;
  sortMetricValue: string;
  sortMetricOptions: SelectOption[];
  onSortMetricChange: (value: string) => void;
  sortOrder: 'ascending' | 'descending';
  onSortOrderChange: (value: 'ascending' | 'descending') => void;
  sortReference: number;
  onSortReferenceChange: (value: number) => void;
  minRbar: number;
  onMinRbarChange: (value: number) => void;

  // Quantity
  numberOfResults: number;
  onNumberOfResultsChange: (value: number) => void;
  minimumSamples: number;
  onMinimumSamplesChange: (value: number) => void;

  // Reset
  onResetFilters: () => void;

  // Computed
  filterParams: SearchTaxaQueryFilters;
  rankingFilterHint: string | null;
  hasActiveFilters: boolean;
};
