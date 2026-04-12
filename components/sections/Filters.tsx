import React from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import { IconRotateCcw } from '@/assets/icons';
import type { SpeciesSummary } from '@/data/types';
import { SearchResults } from '../lists/SearchResults';
import { ButtonDanger } from '@/components/buttons/ButtonDanger';
import { NumberSpinner } from '@/components/inputs/NumberSpinner';
import { RadioField } from '@/components/inputs/RadioField';
import { SearchInput } from '@/components/inputs/SearchInput';
import {
  SelectField,
  type SelectOption,
} from '@/components/inputs/SelectField';
import { SwitchField } from '@/components/inputs/SwitchField';
import { ThemedText } from '@/components/text/ThemedText';
import { GadmAttribution } from './GadmAttribution';
import { SourceAttribution } from './speciesEnvironment/SourceAttribution';
import { useDataSources } from '@/hooks/useDataSources';
import { Size } from '@/constants/theme';

const prependAllOption = (
  options: SelectOption[],
  label: string,
): SelectOption[] => {
  if (options.some((option) => option.value === '')) {
    return options;
  }
  return [{ label, value: '' }, ...options];
};

export type FiltersProps = {
  /** Location */
  countryValue: string;
  countryOptions: SelectOption[];
  onCountryChange?: (value: string) => void;
  stateValue: string;
  stateOptions: SelectOption[];
  onStateChange?: (value: string) => void;
  countyValue: string;
  countyOptions: SelectOption[];
  onCountyChange?: (value: string) => void;

  /** Taxon */
  baseTaxonQuery: string;
  onBaseTaxonQueryChange?: (value: string) => void;
  onBaseTaxonSubmit?: (value: string) => void;
  onBaseTaxonFocus?: () => void;
  onBaseTaxonBlur?: () => void;
  baseTaxonSuggestions?: SpeciesSummary[];
  baseTaxonSuggestionsLoading?: boolean;
  baseTaxonSuggestionsVisible?: boolean;
  onBaseTaxonSelect?: (species: SpeciesSummary) => void;
  hasBaseTaxonSelection?: boolean;
  rankValue: string;
  rankOptions: SelectOption[];
  onRankChange?: (value: string) => void;
  includeSubspecies: boolean;
  onIncludeSubspeciesChange?: (value: boolean) => void;

  /** Sort */
  sortVariableValue: string;
  sortVariableOptions: SelectOption[];
  onSortVariableChange?: (value: string) => void;
  sortVariableSourceIds?: string[];
  sortMetricValue: string;
  sortMetricOptions: SelectOption[];
  onSortMetricChange?: (value: string) => void;
  sortOrder: 'ascending' | 'descending';
  onSortOrderChange?: (value: 'ascending' | 'descending') => void;
  rankingFilterHint?: string | null;
  hasActiveFilters?: boolean;

  /** Quantity */
  numberOfResults: number;
  onNumberOfResultsChange?: (value: number) => void;
  minimumSamples: number;
  onMinimumSamplesChange?: (value: number) => void;

  /** Reset */
  onResetFilters?: () => void;

  style?: StyleProp<ViewStyle>;
};

export function Filters({
  countryValue,
  countryOptions,
  onCountryChange,
  stateValue,
  stateOptions,
  onStateChange,
  countyValue,
  countyOptions,
  onCountyChange,
  baseTaxonQuery,
  onBaseTaxonQueryChange,
  onBaseTaxonSubmit,
  onBaseTaxonFocus,
  onBaseTaxonBlur,
  baseTaxonSuggestions = [],
  baseTaxonSuggestionsLoading = false,
  baseTaxonSuggestionsVisible = false,
  onBaseTaxonSelect,
  hasBaseTaxonSelection = false,
  rankValue,
  rankOptions,
  onRankChange,
  includeSubspecies,
  onIncludeSubspeciesChange,
  sortVariableValue,
  sortVariableOptions,
  onSortVariableChange,
  sortVariableSourceIds,
  sortMetricValue,
  sortMetricOptions,
  onSortMetricChange,
  sortOrder,
  onSortOrderChange,
  rankingFilterHint,
  hasActiveFilters = false,
  numberOfResults,
  onNumberOfResultsChange,
  minimumSamples,
  onMinimumSamplesChange,
  onResetFilters,
  style,
}: FiltersProps) {
  const dataSources = useDataSources();

  const baseTaxonSearchInputProps = React.useMemo(
    () => ({
      variant: 'secondary' as const,
      value: baseTaxonQuery,
      placeholder: 'Search',
      onQueryChange: onBaseTaxonQueryChange,
      onSubmitSearch: onBaseTaxonSubmit,
      onFocus: onBaseTaxonFocus,
      onBlur: onBaseTaxonBlur,
    }),
    [
      baseTaxonQuery,
      onBaseTaxonBlur,
      onBaseTaxonFocus,
      onBaseTaxonQueryChange,
      onBaseTaxonSubmit,
    ],
  );

  const isControlsDisabled = !hasBaseTaxonSelection;
  const countrySelectOptions = React.useMemo(
    () => prependAllOption(countryOptions, 'All countries'),
    [countryOptions],
  );
  const stateSelectOptions = React.useMemo(
    () => prependAllOption(stateOptions, 'All states'),
    [stateOptions],
  );
  const countySelectOptions = React.useMemo(
    () => prependAllOption(countyOptions, 'All counties'),
    [countyOptions],
  );

  return (
    <View style={[styles.container, style]}>
      <ThemedText variant='heading'>Filters</ThemedText>

      {/* Taxon */}
      <View style={styles.subSection}>
        <ThemedText variant='subheading'>Taxon</ThemedText>
        <ThemedText variant='body'>Base taxon</ThemedText>
        <SearchInput {...baseTaxonSearchInputProps} />
        <SearchResults
          results={baseTaxonSuggestions}
          isVisible={
            baseTaxonSuggestionsVisible && baseTaxonQuery.trim().length > 0
          }
          isLoading={baseTaxonSuggestionsLoading}
          emptyMessage='No matching taxa found'
          onSelectResult={onBaseTaxonSelect}
          style={styles.suggestionResultsInline}
          layout='inline'
        />
        <SelectField
          label='Rank'
          description='Only include taxa at this rank'
          value={rankValue}
          options={rankOptions}
          onValueChange={onRankChange}
        />
        <SwitchField
          label='Include subspecies'
          description='Whether or not to include subspecies in the results when filtering to the species level'
          value={includeSubspecies}
          onValueChange={onIncludeSubspeciesChange}
          style={styles.switchFieldFull}
        />
      </View>

      {/* Sort */}
      <View style={styles.subSection}>
        <ThemedText variant='subheading'>Sort</ThemedText>
        <ThemedText variant='body'>
          {rankingFilterHint ??
            'Ranking-based filters apply after setting Base taxon and Sort variable.'}
        </ThemedText>
        <SelectField
          label='Variable'
          placeholder='Select variable'
          value={sortVariableValue}
          options={sortVariableOptions}
          onValueChange={onSortVariableChange}
          disabled={isControlsDisabled}
        />
        {sortVariableSourceIds && sortVariableSourceIds.length > 0 && (
          <SourceAttribution
            sourceIds={sortVariableSourceIds}
            dataSources={dataSources}
          />
        )}
        <SelectField
          label='Sorting metric'
          value={sortMetricValue}
          options={sortMetricOptions}
          onValueChange={onSortMetricChange}
          disabled={isControlsDisabled}
        />
        <ThemedText variant='body'>Sort order</ThemedText>
        <View style={styles.sortOrderRow}>
          <RadioField
            style={styles.sortOrderOption}
            label='Ascending'
            checked={sortOrder === 'ascending'}
            onValueChange={() => onSortOrderChange?.('ascending')}
            disabled={isControlsDisabled}
          />
          <RadioField
            style={styles.sortOrderOption}
            label='Descending'
            checked={sortOrder === 'descending'}
            onValueChange={() => onSortOrderChange?.('descending')}
            disabled={isControlsDisabled}
          />
        </View>
      </View>

      {/* Location */}
      <View style={styles.subSection}>
        <ThemedText variant='subheading'>Location</ThemedText>
        {isControlsDisabled ? (
          <ThemedText variant='body'>
            Location filters apply after choosing a Base taxon.
          </ThemedText>
        ) : null}
        <View style={styles.locationGrid}>
          <SelectField
            label='Country'
            value={countryValue}
            options={countrySelectOptions}
            onValueChange={onCountryChange}
            disabled={isControlsDisabled}
            style={styles.locationField}
          />
          <SelectField
            label='State'
            value={stateValue}
            options={stateSelectOptions}
            onValueChange={onStateChange}
            disabled={isControlsDisabled}
            style={styles.locationField}
          />
          <SelectField
            label='County'
            value={countyValue}
            options={countySelectOptions}
            onValueChange={onCountyChange}
            disabled={isControlsDisabled}
            style={styles.locationField}
          />
        </View>
        <GadmAttribution />
      </View>

      {/* Quantity */}
      <View style={styles.subSection}>
        <ThemedText variant='subheading'>Quantity</ThemedText>
        <NumberSpinner
          label='Number of results'
          description='How many results to return'
          value={numberOfResults}
          min={1}
          onValueChange={onNumberOfResultsChange}
        />
        <NumberSpinner
          label='Minimum samples'
          description='Show only results with at least this number of samples'
          value={minimumSamples}
          min={1}
          disabled={!hasActiveFilters}
          onValueChange={onMinimumSamplesChange}
        />
      </View>

      {/* Reset */}
      <ButtonDanger
        variant='primary'
        size='medium'
        iconStart={<IconRotateCcw />}
        onPress={onResetFilters}
        style={styles.resetButton}
      >
        Reset filters
      </ButtonDanger>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 240,
    gap: Size.space.text.subsection,
  },
  subSection: {
    gap: Size.space.text.paragraph,
  },
  locationGrid: {
    flexDirection: 'column',
    gap: Size.space.text.line,
  },
  locationField: {
    width: '100%',
  },
  sortOrderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space.text.line,
  },
  sortOrderOption: {
    flex: 1,
  },
  switchFieldFull: {
    maxWidth: '100%',
  },
  resetButton: {
    alignSelf: 'flex-start',
  },
  suggestionResultsInline: {
    marginTop: Size.space['100'],
  },
});
