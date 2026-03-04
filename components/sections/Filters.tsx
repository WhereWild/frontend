import React from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import { IconRotateCcw } from '@/assets/icons';
import { ButtonDanger } from '@/components/buttons/ButtonDanger';
import { NumberSpinner } from '@/components/inputs/NumberSpinner';
import { RadioField } from '@/components/inputs/RadioField';
import { SearchInput } from '@/components/inputs/SearchInput';
import { SelectField, type SelectOption } from '@/components/inputs/SelectField';
import { SwitchField } from '@/components/inputs/SwitchField';
import { ThemedText } from '@/components/text/ThemedText';
import { Size } from '@/constants/theme';

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
  rankValue: string;
  rankOptions: SelectOption[];
  onRankChange?: (value: string) => void;
  includeSubspecies: boolean;
  onIncludeSubspeciesChange?: (value: boolean) => void;

  /** Sort */
  sortVariableValue: string;
  sortVariableOptions: SelectOption[];
  onSortVariableChange?: (value: string) => void;
  sortMetricValue: string;
  sortMetricOptions: SelectOption[];
  onSortMetricChange?: (value: string) => void;
  sortOrder: 'ascending' | 'descending';
  onSortOrderChange?: (value: 'ascending' | 'descending') => void;

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
  rankValue,
  rankOptions,
  onRankChange,
  includeSubspecies,
  onIncludeSubspeciesChange,
  sortVariableValue,
  sortVariableOptions,
  onSortVariableChange,
  sortMetricValue,
  sortMetricOptions,
  onSortMetricChange,
  sortOrder,
  onSortOrderChange,
  numberOfResults,
  onNumberOfResultsChange,
  minimumSamples,
  onMinimumSamplesChange,
  onResetFilters,
  style,
}: FiltersProps) {
  return (
    <View style={[styles.container, style]}>
      <ThemedText variant="heading">Filters</ThemedText>

      {/* Location */}
      <View style={styles.section}>
        <ThemedText variant="subheading">Location</ThemedText>
        <View style={styles.locationGrid}>
          <SelectField
            label="Country"
            value={countryValue}
            options={countryOptions}
            onValueChange={onCountryChange}
            style={styles.locationField}
          />
          <SelectField
            label="State"
            description="Only shows administrative regions where the species has been observed"
            value={stateValue}
            options={stateOptions}
            onValueChange={onStateChange}
            style={styles.locationField}
          />
          <SelectField
            label="County"
            description="Only shows administrative subregions where the species has been observed"
            value={countyValue}
            options={countyOptions}
            onValueChange={onCountyChange}
            style={styles.locationField}
          />
        </View>
      </View>

      {/* Taxon */}
      <View style={styles.section}>
        <ThemedText variant="subheading">Taxon</ThemedText>
        <ThemedText variant="body">Base taxon</ThemedText>
        <SearchInput
          value={baseTaxonQuery}
          placeholder="Search"
          onQueryChange={onBaseTaxonQueryChange}
          onSubmitSearch={onBaseTaxonSubmit}
        />
        <SelectField
          label="Rank"
          description="Only include taxa at this rank"
          value={rankValue}
          options={rankOptions}
          onValueChange={onRankChange}
        />
        <SwitchField
          label="Include subspecies"
          description="Whether or not to include subspecies in the results when filtering to the species level"
          value={includeSubspecies}
          onValueChange={onIncludeSubspeciesChange}
          style={styles.switchFieldFull}
        />
      </View>

      {/* Sort */}
      <View style={styles.section}>
        <ThemedText variant="subheading">Sort</ThemedText>
        <ThemedText variant="body" style={styles.filterHint}>
          Ranking-based filters apply after setting Base taxon and Sort variable.
        </ThemedText>
        <SelectField
          label="Variable"
          description="What variable to sort by"
          placeholder="Select variable"
          value={sortVariableValue}
          options={sortVariableOptions}
          onValueChange={onSortVariableChange}
        />
        <SelectField
          label="Sorting metric"
          description="What metric to sort the variable by"
          value={sortMetricValue}
          options={sortMetricOptions}
          onValueChange={onSortMetricChange}
        />
        <ThemedText variant="body">Sort order</ThemedText>
        <View style={styles.sortOrderRow}>
          <RadioField
            style={styles.sortOrderOption}
            label="Ascending"
            checked={sortOrder === 'ascending'}
            onValueChange={() => onSortOrderChange?.('ascending')}
          />
          <RadioField
            style={styles.sortOrderOption}
            label="Descending"
            checked={sortOrder === 'descending'}
            onValueChange={() => onSortOrderChange?.('descending')}
          />
        </View>
      </View>

      {/* Quantity */}
      <View style={styles.section}>
        <ThemedText variant="subheading">Quantity</ThemedText>
        <NumberSpinner
          label="Number of results"
          description="How many results to return"
          value={numberOfResults}
          min={1}
          onValueChange={onNumberOfResultsChange}
        />
        <NumberSpinner
          label="Minimum samples"
          description="Show only results with at least this number of samples"
          value={minimumSamples}
          min={1}
          onValueChange={onMinimumSamplesChange}
        />
      </View>

      {/* Reset */}
      <ButtonDanger
        variant="primary"
        size="medium"
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
    maxWidth: 480,
    minWidth: 240,
    gap: Size.space.text.subsection,
  },
  section: {
    gap: Size.space.text.paragraph,
  },
  filterHint: {
    marginTop: -Size.space.text.line,
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
});
