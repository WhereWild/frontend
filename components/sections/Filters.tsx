import React from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle, type LayoutRectangle } from 'react-native';
import { IconRotateCcw } from '@/assets/icons';
import type { SpeciesSummary } from '@/data/types';
import { Portal } from '@/components/Portal';
import { SearchResults } from './webPageHeader/SearchResults';
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
  onBaseTaxonFocus?: () => void;
  onBaseTaxonBlur?: () => void;
  baseTaxonSuggestions?: SpeciesSummary[];
  baseTaxonSuggestionsLoading?: boolean;
  baseTaxonSuggestionsVisible?: boolean;
  onBaseTaxonSelect?: (species: SpeciesSummary) => void;
  onBaseTaxonSuggestionsDismiss?: () => void;
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
  rankingFilterHint?: string | null;

  /** Quantity */
  numberOfResults: number;
  onNumberOfResultsChange?: (value: number) => void;
  minimumSamples: number;
  onMinimumSamplesChange?: (value: number) => void;

  /** Reset */
  onResetFilters?: () => void;

  /**
   * Test-only override for the base-taxon anchor ref.
   * Do not use in production code.
   */
  anchorRefOverride?: React.RefObject<View | null>;

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
  onBaseTaxonSuggestionsDismiss,
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
  rankingFilterHint,
  numberOfResults,
  onNumberOfResultsChange,
  minimumSamples,
  onMinimumSamplesChange,
  onResetFilters,
  anchorRefOverride,
  style,
}: FiltersProps) {
  const internalAnchorRef = React.useRef<View>(null);
  const anchorRef = anchorRefOverride ?? internalAnchorRef;
  const [dropdownPosition, setDropdownPosition] = React.useState<LayoutRectangle | null>(null);

  const measureAnchor = React.useCallback(() => {
    anchorRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setDropdownPosition({ x: pageX, y: pageY, width, height });
    });
  }, [anchorRef]);

  const handleAnchorLayout = React.useCallback(() => {
    if (!baseTaxonSuggestionsVisible) {
      return;
    }
    measureAnchor();
  }, [baseTaxonSuggestionsVisible, measureAnchor]);

  React.useEffect(() => {
    if (!baseTaxonSuggestionsVisible) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      measureAnchor();
    });
    return () => cancelAnimationFrame(frame);
  }, [baseTaxonSuggestionsVisible, measureAnchor]);

  const baseTaxonSearchInputProps = React.useMemo(
    () => ({
      value: baseTaxonQuery,
      placeholder: 'Search',
      onQueryChange: onBaseTaxonQueryChange,
      onSubmitSearch: onBaseTaxonSubmit,
      onFocus: onBaseTaxonFocus,
      onBlur: onBaseTaxonBlur,
    }),
    [baseTaxonQuery, onBaseTaxonQueryChange, onBaseTaxonSubmit, onBaseTaxonFocus, onBaseTaxonBlur],
  );

  return (
    <View style={[styles.container, style]}>
      <ThemedText variant="heading">Filters</ThemedText>

      {/* Taxon */}
      <View style={styles.subSection}>
        <ThemedText variant="subheading">Taxon</ThemedText>
        <ThemedText variant="body">Base taxon</ThemedText>
        <View testID="filters-base-taxon-anchor" ref={anchorRef} style={styles.suggestionAnchor} onLayout={handleAnchorLayout}>
          <SearchInput {...baseTaxonSearchInputProps} />
        </View>
        <Portal
          visible={baseTaxonSuggestionsVisible}
          onDismiss={onBaseTaxonSuggestionsDismiss}
          accessibilityLabel="Base taxon suggestions"
          accessibilityHint="Type to refine options or tap outside to dismiss."
        >
          <Pressable
            style={styles.backdrop}
            onPress={onBaseTaxonSuggestionsDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close base taxon suggestions"
          />
          {dropdownPosition ? (
            <View
              style={[
                styles.portalInputWrapper,
                {
                  top: dropdownPosition.y,
                  left: dropdownPosition.x,
                  width: dropdownPosition.width,
                  height: dropdownPosition.height,
                },
              ]}
            >
              <SearchInput {...baseTaxonSearchInputProps} autoFocus />
            </View>
          ) : null}
          <SearchResults
            results={baseTaxonSuggestions}
            isVisible={baseTaxonSuggestionsVisible && baseTaxonQuery.trim().length > 0}
            isLoading={baseTaxonSuggestionsLoading}
            emptyMessage="No matching taxa found"
            onSelectResult={onBaseTaxonSelect}
            onPointerEnter={onBaseTaxonFocus}
            onTouchStart={onBaseTaxonFocus}
            onFocus={onBaseTaxonFocus}
            style={dropdownPosition ? [
              styles.suggestionResults,
              {
                top: dropdownPosition.y + dropdownPosition.height + Size.space['200'],
                left: dropdownPosition.x,
                width: dropdownPosition.width,
              },
            ] : styles.suggestionResults}
          />
        </Portal>
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
      <View style={styles.subSection}>
        <ThemedText variant="subheading">Sort</ThemedText>
        <ThemedText variant="body">
          {rankingFilterHint ?? 'Ranking-based filters apply after setting Base taxon and Sort variable.'}
        </ThemedText>
        <SelectField
          label="Variable"
          placeholder="Select variable"
          value={sortVariableValue}
          options={sortVariableOptions}
          onValueChange={onSortVariableChange}
        />
        <SelectField
          label="Sorting metric"
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

      {/* Location */}
      <View style={styles.subSection}>
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
            value={stateValue}
            options={stateOptions}
            onValueChange={onStateChange}
            style={styles.locationField}
          />
          <SelectField
            label="County"
            value={countyValue}
            options={countyOptions}
            onValueChange={onCountyChange}
            style={styles.locationField}
          />
        </View>
      </View>

      {/* Quantity */}
      <View style={styles.subSection}>
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
  suggestionAnchor: {
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  portalInputWrapper: {
    position: 'absolute',
    zIndex: 10001,
  },
  suggestionResults: {
    position: 'absolute',
    zIndex: 10002,
  },
});
