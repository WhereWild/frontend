import { Colors, Responsive, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { ContinuousInsights } from './speciesEnvironment/ContinuousInsights';
import { DensityChart } from './speciesEnvironment/DensityChart';
import { StackedCategoryBar } from './speciesEnvironment/StackedCategoryBar';
import { VariableSelectorHeader } from './speciesEnvironment/VariableSelectorHeader';
import { DEFAULT_VARIABLE, type EnvironmentVariableOption } from './speciesEnvironment/model';
import { useSpeciesEnvironmentState } from './speciesEnvironment/useSpeciesEnvironmentState';

/** Props for rendering the species environment analytics section. */
export type SpeciesEnvironmentSectionProps = {
  /** Taxon ID used to fetch environment statistics. */
  taxonId?: number;
  /** Initial environment variable ID to load. */
  variableId?: string;
  /** Optional environment variable catalog override. */
  variables?: EnvironmentVariableOption[];
  /** Receives catalog numbers highlighted by chart/category selection. */
  onHighlightChange?: (catalogNumbers: (number | string)[]) => void;
  /** Optional geographic filter gid applied to environment requests. */
  locationGid?: string | null;
  units?: 'metric' | 'imperial' | undefined;
};

/** Displays environment distribution insights for a species and selected variable. */
export function SpeciesEnvironmentSection({
  taxonId,
  variableId = DEFAULT_VARIABLE,
  variables,
  onHighlightChange,
  locationGid,
  units,
}: SpeciesEnvironmentSectionProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const {
    categories,
    selectedVariableCategory,
    setSelectedVariableCategory,
    filteredVariables,
    selectedVariable,
    setSelectedVariable,
    headingText,
    metaText,
    loading,
    stats,
    isVariableCategorical,
    error,
    isCategorical,
    categoricalDistribution,
    selectedCategoryValue,
    setSelectedCategoryValue,
    densityCurve,
    summary,
    selectedDensityRange,
    handleDensitySelectionChange,
    showRankContext,
    rankContextOptions,
    selectedRankContext,
    setSelectedRankContext,
    summaryRanks,
    summaryComparisons,
    locationFilterActive,
  } = useSpeciesEnvironmentState({
    taxonId,
    variableId,
    variables,
    onHighlightChange,
    locationGid,
    units,
  });

  if (!taxonId) {
    return null;
  }

  const showLoading = loading && !stats;
  const showError = !loading && Boolean(error);

  const handleCategorySelect = (value: string | number) => {
    setSelectedCategoryValue((previous) => (previous === value ? null : value));
  };

  const handleRankContextChange = (value: string) => setSelectedRankContext(value);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background.default.secondary,
        },
      ]}
    >
      <VariableSelectorHeader
        categories={categories}
        selectedVariableCategory={selectedVariableCategory}
        onCategoryChange={setSelectedVariableCategory}
        filteredVariables={filteredVariables}
        selectedVariable={selectedVariable}
        onVariableChange={setSelectedVariable}
        headingText={headingText}
        metaText={metaText}
      />

      {showLoading ? (
        <View
          style={[
            styles.loadingPlaceholder,
            isVariableCategorical
              ? styles.loadingPlaceholderCategorical
              : styles.loadingPlaceholderContinuous,
          ]}
        >
          <ActivityIndicator color={palette.icon.brand.default} />
          <ThemedText variant="bodySmall">Loading environment data…</ThemedText>
        </View>
      ) : null}

      {showError ? (
        <View style={styles.errorRow}>
          <ThemedText variant="bodySmall">{error}</ThemedText>
        </View>
      ) : null}

      {stats ? (
        isCategorical ? (
          <StackedCategoryBar
            categories={categoricalDistribution}
            selectedValue={selectedCategoryValue}
            onSelect={handleCategorySelect}
            descriptionColor={palette.text.default.secondary}
          />
        ) : (
          <>
            <DensityChart
              curve={densityCurve}
              lineColor={palette.background.brand.default}
              fillColor={palette.background.brand.default}
              baselineColor={palette.border.neutral.default}
              summary={summary}
              selection={selectedDensityRange}
              onSelectionChange={handleDensitySelectionChange}
            />

            <ContinuousInsights
              showRankContext={showRankContext}
              rankContextOptions={rankContextOptions}
              selectedRankContext={selectedRankContext}
              onRankContextChange={handleRankContextChange}
              summary={summary}
              summaryRanks={summaryRanks}
              summaryComparisons={summaryComparisons}
              locationFilterActive={locationFilterActive}
            />
          </>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: Responsive.contentWidth,
    borderRadius: Size.radius['200'],
    padding: Size.space['400'],
    alignSelf: 'center',
    gap: Size.space['400'],
  },
  loadingPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  loadingPlaceholderContinuous: {
    minHeight: 300,
  },
  loadingPlaceholderCategorical: {
    minHeight: 200,
  },
  errorRow: {
    paddingVertical: Size.space['200'],
  },
});
