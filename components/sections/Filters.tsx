// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';
import {
  formatWindowHours,
  parseTemporalId,
  stripTemporalSuffix,
} from '@/components/sections/speciesEnvironment/temporalHelpers';
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
import { SourceAttribution } from './SourceAttribution';
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
  rankValue: string;
  rankOptions: SelectOption[];
  onRankChange?: (value: string) => void;
  includeSubspecies: boolean;
  onIncludeSubspeciesChange?: (value: boolean) => void;

  /** Sort */
  sortVariableValue: string;
  sortVariableOptions: SelectOption[];
  sortVariableDisabled?: boolean;
  onSortVariableChange?: (value: string) => void;
  sortVariableSourceIds?: string[];
  sortMetricValue: string;
  sortMetricOptions: SelectOption[];
  onSortMetricChange?: (value: string) => void;
  sortOrder: 'ascending' | 'descending';
  onSortOrderChange?: (value: 'ascending' | 'descending') => void;
  sortReference: number;
  onSortReferenceChange?: (value: number) => void;
  listOffset: number;
  onListOffsetChange?: (value: number) => void;
  minRbar: number;
  onMinRbarChange?: (value: number) => void;
  rankingFilterHint?: string | null;

  /** Quantity */
  numberOfResults: number;
  onNumberOfResultsChange?: (value: number) => void;
  minimumSamples: number;
  onMinimumSamplesChange?: (value: number) => void;

  /** Reset */
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;

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
  rankValue,
  rankOptions,
  onRankChange,
  includeSubspecies,
  onIncludeSubspeciesChange,
  sortVariableValue,
  sortVariableOptions,
  sortVariableDisabled = false,
  onSortVariableChange,
  sortVariableSourceIds,
  sortMetricValue,
  sortMetricOptions,
  onSortMetricChange,
  sortOrder,
  onSortOrderChange,
  sortReference,
  onSortReferenceChange,
  listOffset,
  onListOffsetChange,
  minRbar,
  onMinRbarChange,
  rankingFilterHint,
  numberOfResults,
  onNumberOfResultsChange,
  minimumSamples,
  onMinimumSamplesChange,
  onResetFilters,
  hasActiveFilters = false,
  style,
}: FiltersProps) {
  const dataSources = useDataSources();
  const includeSubspeciesEnabled = rankValue === 'species';
  const isCircularBearing =
    sortMetricValue === 'circular_mean' || sortMetricValue === 'mode';

  const baseVariableOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const option of sortVariableOptions) {
      const parsed = parseTemporalId(option.value);
      if (parsed) {
        if (!seen.has(parsed.baseId)) {
          seen.set(parsed.baseId, stripTemporalSuffix(option.label));
        }
      } else {
        if (!seen.has(option.value)) {
          seen.set(option.value, option.label);
        }
      }
    }
    return Array.from(seen.entries()).map(([value, label]) => ({ value, label }));
  }, [sortVariableOptions]);

  const parsedSortVariable = React.useMemo(
    () => parseTemporalId(sortVariableValue),
    [sortVariableValue],
  );

  const selectedBaseKey = parsedSortVariable?.baseId ?? sortVariableValue;

  const windowOptions = React.useMemo(() => {
    if (!parsedSortVariable || !selectedBaseKey) return [];
    return sortVariableOptions
      .flatMap((option) => {
        const p = parseTemporalId(option.value);
        return p && p.baseId === selectedBaseKey ? [{ p, value: option.value }] : [];
      })
      .sort((a, b) => a.p.windowHours - b.p.windowHours)
      .map(({ p, value }) => ({
        value,
        label: `${formatWindowHours(p.windowHours)} (${p.agg})`,
      }));
  }, [parsedSortVariable, selectedBaseKey, sortVariableOptions]);

  const handleBaseChange = React.useCallback(
    (newBase: string) => {
      const firstWindow = sortVariableOptions
        .flatMap((option) => {
          const p = parseTemporalId(option.value);
          return p && p.baseId === newBase ? [{ p, value: option.value }] : [];
        })
        .sort((a, b) => a.p.windowHours - b.p.windowHours)[0];
      onSortVariableChange?.(firstWindow ? firstWindow.value : newBase);
    },
    [sortVariableOptions, onSortVariableChange],
  );

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
        <ThemedText variant='body'>Scope taxon</ThemedText>
        <SearchInput
          variant='secondary'
          value={baseTaxonQuery}
          placeholder='Search'
          onQueryChange={onBaseTaxonQueryChange}
          onSubmitSearch={onBaseTaxonSubmit}
          onFocus={onBaseTaxonFocus}
          onBlur={onBaseTaxonBlur}
        />
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
      </View>

      {/* Ranking */}
      <View style={styles.subSection}>
        <ThemedText variant='subheading'>Ranking</ThemedText>
        <ThemedText variant='body'>
          {rankingFilterHint ??
            'Add a Scope taxon to limit search results to descendant taxa. Then choose Rank, Variable, and Metric to rank within that scope.'}
        </ThemedText>
        <SelectField
          label='Rank'
          description='Only include taxa at this rank'
          value={rankValue}
          options={rankOptions}
          onValueChange={onRankChange}
        />
        <SwitchField
          label='Include subspecies'
          description={
            includeSubspeciesEnabled
              ? 'Include or exclude subspecies when Rank is set to Species'
              : 'Available only when Rank is set to Species'
          }
          value={includeSubspecies}
          disabled={!includeSubspeciesEnabled}
          onValueChange={onIncludeSubspeciesChange}
          style={styles.switchFieldFull}
        />
        <SelectField
          label='Variable'
          placeholder='Select variable'
          disabled={sortVariableDisabled}
          value={selectedBaseKey}
          options={baseVariableOptions}
          onValueChange={handleBaseChange}
        />
        {!sortVariableDisabled && windowOptions.length > 0 && (
          <SelectField
            label='Time window'
            value={sortVariableValue}
            options={windowOptions}
            onValueChange={onSortVariableChange}
          />
        )}
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
        />
        <ThemedText variant='body'>Sort order</ThemedText>
        <View style={styles.sortOrderRow}>
          <RadioField
            style={styles.sortOrderOption}
            label={isCircularBearing ? 'Clockwise' : 'Ascending'}
            checked={sortOrder === 'ascending'}
            onValueChange={() => onSortOrderChange?.('ascending')}
          />
          <RadioField
            style={styles.sortOrderOption}
            label={isCircularBearing ? 'Counter-clockwise' : 'Descending'}
            checked={sortOrder === 'descending'}
            onValueChange={() => onSortOrderChange?.('descending')}
          />
        </View>
        {sortMetricValue.length > 0 && (
          <>
            {isCircularBearing ? (
              <>
                <NumberSpinner
                  label='Offset (°)'
                  description='Starting bearing for the sort walk (0–359°).'
                  value={sortReference}
                  min={0}
                  max={359}
                  onValueChange={onSortReferenceChange}
                />
                <NumberSpinner
                  label='Min. concentration (R̄)'
                  description='Exclude taxa whose circular mean has low concentration. Each step = 0.05; set to 0 to disable.'
                  value={minRbar}
                  min={0}
                  max={1}
                  step={0.05}
                  precision={2}
                  onValueChange={onMinRbarChange}
                />
              </>
            ) : (
              <NumberSpinner
                label='Offset'
                description='Skip this many results — shows the list starting from this position.'
                value={listOffset}
                min={0}
                onValueChange={onListOffsetChange}
              />
            )}
          </>
        )}
        <NumberSpinner
          label='Minimum samples'
          description='Show only ranked results with at least this number of samples.'
          value={minimumSamples}
          min={10}
          onValueChange={onMinimumSamplesChange}
        />
      </View>

      {/* Location */}
      <View style={styles.subSection}>
        <ThemedText variant='subheading'>Location</ThemedText>
        <View style={styles.locationGrid}>
          <SelectField
            label='Country'
            value={countryValue}
            options={countrySelectOptions}
            onValueChange={onCountryChange}
            style={styles.locationField}
          />
          <SelectField
            label='State'
            value={stateValue}
            options={stateSelectOptions}
            onValueChange={onStateChange}
            style={styles.locationField}
          />
          <SelectField
            label='County'
            value={countyValue}
            options={countySelectOptions}
            onValueChange={onCountyChange}
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
      </View>

      {/* Reset */}
      <ButtonDanger
        variant='primary'
        size='medium'
        iconStart={<IconRotateCcw />}
        enableHaptics={hasActiveFilters}
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
