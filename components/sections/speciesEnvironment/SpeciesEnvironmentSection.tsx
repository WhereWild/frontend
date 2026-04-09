import { Colors, Responsive, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { AspectCompassChart } from './AspectCompassChart';
import { ContinuousInsights } from './ContinuousInsights';
import { DensityChart } from './DensityChart';
import { PolarDensityChart } from './PolarDensityChart';
import { StackedCategoryBar } from './StackedCategoryBar';
import { VariableSelectorHeader } from './VariableSelectorHeader';
import { DEFAULT_VARIABLE, type EnvironmentVariableOption } from './model';
import { useSpeciesEnvironmentState } from './useSpeciesEnvironmentState';

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
  pinnedObservation?: {
    catalogNumber: string;
    lat: number;
    lon: number;
  } | null;
};

/** Displays environment distribution insights for a species and selected variable. */
function SpeciesEnvironmentSectionComponent({
  taxonId,
  variableId = DEFAULT_VARIABLE,
  variables,
  onHighlightChange,
  locationGid,
  units,
  pinnedObservation,
}: SpeciesEnvironmentSectionProps) {
  const stableDisplayRef = React.useRef<{
    headingText: string | null;
    metaText: string | null;
    isCategorical: boolean;
    categoricalDistribution: ReturnType<
      typeof useSpeciesEnvironmentState
    >['categoricalDistribution'];
    selectedCategoryValue: ReturnType<
      typeof useSpeciesEnvironmentState
    >['selectedCategoryValue'];
    densityCurve: ReturnType<typeof useSpeciesEnvironmentState>['densityCurve'];
    summary: ReturnType<typeof useSpeciesEnvironmentState>['summary'];
    selectedDensityRange: ReturnType<
      typeof useSpeciesEnvironmentState
    >['selectedDensityRange'];
    showRankContext: boolean;
    rankContextOptions: ReturnType<
      typeof useSpeciesEnvironmentState
    >['rankContextOptions'];
    selectedRankContext: ReturnType<
      typeof useSpeciesEnvironmentState
    >['selectedRankContext'];
    summaryRanks: ReturnType<typeof useSpeciesEnvironmentState>['summaryRanks'];
    summaryComparisons: ReturnType<
      typeof useSpeciesEnvironmentState
    >['summaryComparisons'];
    locationFilterActive: boolean;
    pinnedCategoryValue: ReturnType<
      typeof useSpeciesEnvironmentState
    >['pinnedCategoryValue'];
    pinnedUnobservedCategory: ReturnType<
      typeof useSpeciesEnvironmentState
    >['pinnedUnobservedCategory'];
    pinnedClassName: ReturnType<
      typeof useSpeciesEnvironmentState
    >['pinnedClassName'];
    pinnedValue: ReturnType<typeof useSpeciesEnvironmentState>['pinnedValue'];
  } | null>(null);
  const stableContentScopeRef = React.useRef('');
  const stableContentScope = `${taxonId ?? ''}|${locationGid ?? ''}|${units ?? ''}`;

  if (stableContentScopeRef.current !== stableContentScope) {
    stableContentScopeRef.current = stableContentScope;
    stableDisplayRef.current = null;
  }

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
    pinnedCategoryValue,
    pinnedUnobservedCategory,
    pinnedClassName,
    pinnedValue,
    pinnedLoading,
    isCircularVariable,
  } = useSpeciesEnvironmentState({
    taxonId,
    variableId,
    variables,
    onHighlightChange,
    locationGid,
    units,
    pinnedObservation,
  });

  if (!taxonId) {
    return null;
  }

  const shouldPreservePreviousUi = loading && !stats;
  const shouldClearPreservedUi = !loading && !stats;

  if (shouldClearPreservedUi) {
    stableDisplayRef.current = null;
  }

  const showLoading = loading && !stats && !stableDisplayRef.current;
  const showUpdating = loading && !stats && Boolean(stableDisplayRef.current);
  const showError = !loading && Boolean(error);

  const handleCategorySelect = (value: string | number) => {
    React.startTransition(() => {
      setSelectedCategoryValue((previous) =>
        previous === value ? null : value,
      );
    });
  };

  const handleRankContextChange = (value: string) => {
    React.startTransition(() => {
      setSelectedRankContext(value);
    });
  };

  const handleVariableCategoryChange = (value: string) => {
    React.startTransition(() => {
      setSelectedVariableCategory(value);
    });
  };

  const handleVariableChange = (value: string) => {
    React.startTransition(() => {
      setSelectedVariable(value);
    });
  };

  const displayState = stats
    ? {
        headingText,
        metaText,
        isCategorical,
        categoricalDistribution,
        selectedCategoryValue,
        densityCurve,
        summary,
        selectedDensityRange,
        showRankContext,
        rankContextOptions,
        selectedRankContext,
        summaryRanks,
        summaryComparisons,
        locationFilterActive,
        pinnedCategoryValue,
        pinnedUnobservedCategory,
        pinnedClassName,
        pinnedValue,
      }
    : shouldPreservePreviousUi
      ? stableDisplayRef.current
      : null;

  if (stats) {
    stableDisplayRef.current = displayState;
  }

  const hasDisplayState = Boolean(displayState);
  const displayHeadingText = displayState?.headingText ?? null;
  const displayMetaText = displayState?.metaText ?? null;
  const showCategoricalContent = Boolean(displayState?.isCategorical);
  const showContinuousContent = Boolean(
    displayState && !displayState.isCategorical,
  );
  const numericPinnedValue =
    typeof pinnedValue === 'number' ? pinnedValue : null;

  return (
    <View collapsable={false} style={styles.container}>
      <ThemedText variant='subheading'>Species Environment</ThemedText>

      <VariableSelectorHeader
        categories={categories}
        selectedVariableCategory={selectedVariableCategory}
        onCategoryChange={handleVariableCategoryChange}
        filteredVariables={filteredVariables}
        selectedVariable={selectedVariable}
        onVariableChange={handleVariableChange}
        headingText={displayHeadingText}
        metaText={displayMetaText}
      />

      <View collapsable={false} style={styles.statusSlot}>
        <View
          collapsable={false}
          testID='species-environment-loading-slot'
          accessibilityElementsHidden={!showLoading}
          importantForAccessibility={
            showLoading ? 'auto' : 'no-hide-descendants'
          }
          style={[
            styles.statusContentSlot,
            !showLoading && styles.hiddenContentSlot,
          ]}
        >
          <View
            style={[
              styles.loadingPlaceholder,
              isVariableCategorical
                ? styles.loadingPlaceholderCategorical
                : styles.loadingPlaceholderContinuous,
            ]}
          >
            <ActivityIndicator color={palette.icon.brand.default} />
            <ThemedText variant='bodySmall'>
              Loading environment data…
            </ThemedText>
          </View>
        </View>
        <View
          collapsable={false}
          testID='species-environment-updating-slot'
          accessibilityElementsHidden={!showUpdating}
          importantForAccessibility={
            showUpdating ? 'auto' : 'no-hide-descendants'
          }
          style={[
            styles.statusContentSlot,
            !showUpdating && styles.hiddenContentSlot,
          ]}
        >
          <View style={styles.updatingIndicatorRow}>
            <ActivityIndicator
              size='small'
              color={palette.icon.brand.default}
            />
            <ThemedText variant='bodySmall'>
              Updating environment data…
            </ThemedText>
          </View>
        </View>
        <View
          collapsable={false}
          testID='species-environment-error-slot'
          accessibilityElementsHidden={!showError}
          importantForAccessibility={showError ? 'auto' : 'no-hide-descendants'}
          style={[
            styles.statusContentSlot,
            !showError && styles.hiddenContentSlot,
          ]}
        >
          <View style={styles.errorRow}>
            <ThemedText variant='bodySmall'>{error}</ThemedText>
          </View>
        </View>
      </View>

      <View
        collapsable={false}
        testID='species-environment-display-slot'
        accessibilityElementsHidden={!hasDisplayState}
        importantForAccessibility={
          hasDisplayState ? 'auto' : 'no-hide-descendants'
        }
        style={[
          styles.contentRegion,
          !hasDisplayState && styles.hiddenContentSlot,
          { pointerEvents: showUpdating ? 'none' : 'auto' },
        ]}
      >
        <View
          collapsable={false}
          testID='species-environment-categorical-slot'
          accessibilityElementsHidden={!showCategoricalContent}
          importantForAccessibility={
            showCategoricalContent ? 'auto' : 'no-hide-descendants'
          }
          style={!showCategoricalContent ? styles.hiddenContentSlot : undefined}
        >
          {selectedVariable === 'aspect' ||
          selectedVariable === 'Aspect (binned)' ? (
            <AspectCompassChart
              categories={displayState?.categoricalDistribution ?? []}
              selectedValue={displayState?.selectedCategoryValue ?? null}
              highlightedValue={displayState?.pinnedCategoryValue ?? null}
              unobservedHighlightedCategory={
                displayState?.pinnedUnobservedCategory ?? null
              }
              onSelect={handleCategorySelect}
              descriptionColor={palette.text.default.secondary}
              fillColor={palette.background.brand.default}
              selectedFillColor={palette.background.brand.default}
              highlightOutlineColor='#F59E0B'
            />
          ) : (
            <StackedCategoryBar
              categories={displayState?.categoricalDistribution ?? []}
              selectedValue={displayState?.selectedCategoryValue ?? null}
              pinnedValue={displayState?.pinnedValue ?? null}
              pinnedClassName={displayState?.pinnedClassName ?? null}
              highlightedValue={displayState?.pinnedCategoryValue ?? null}
              unobservedHighlightedCategory={
                displayState?.pinnedUnobservedCategory ?? null
              }
              onSelect={handleCategorySelect}
              descriptionColor={palette.text.default.secondary}
              highlightOutlineColor='#F59E0B'
            />
          )}
        </View>

        <View
          collapsable={false}
          testID='species-environment-continuous-slot'
          accessibilityElementsHidden={!showContinuousContent}
          importantForAccessibility={
            showContinuousContent ? 'auto' : 'no-hide-descendants'
          }
          style={[
            styles.continuousContent,
            !showContinuousContent && styles.hiddenContentSlot,
          ]}
        >
          {isCircularVariable ? (
            <PolarDensityChart
              curve={displayState?.densityCurve}
              fillColor={palette.background.brand.default}
              lineColor={palette.background.brand.default}
              guideColor={palette.text.default.secondary}
              selection={displayState?.selectedDensityRange ?? null}
              onSelectionChange={handleDensitySelectionChange}
              pinValue={numericPinnedValue}
              pinLoading={pinnedLoading}
            />
          ) : (
            <>
              <DensityChart
                curve={displayState?.densityCurve}
                lineColor={palette.background.brand.default}
                fillColor={palette.background.brand.default}
                baselineColor={palette.border.neutral.default}
                summary={displayState?.summary}
                selection={displayState?.selectedDensityRange ?? null}
                onSelectionChange={handleDensitySelectionChange}
                pinValue={numericPinnedValue}
                pinLoading={pinnedLoading}
              />

              <ContinuousInsights
                showRankContext={displayState?.showRankContext ?? false}
                rankContextOptions={displayState?.rankContextOptions ?? []}
                selectedRankContext={displayState?.selectedRankContext ?? null}
                onRankContextChange={handleRankContextChange}
                summary={displayState?.summary}
                summaryRanks={
                  displayState?.summaryRanks ?? {
                    min: null,
                    mean: null,
                    max: null,
                  }
                }
                summaryComparisons={
                  displayState?.summaryComparisons ?? {
                    min: null,
                    mean: null,
                    max: null,
                  }
                }
                locationFilterActive={
                  displayState?.locationFilterActive ?? false
                }
              />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: Responsive.contentWidth,
    alignSelf: 'center',
    gap: Size.space.text.paragraph,
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
  updatingIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['150'],
  },
  statusSlot: {
    width: '100%',
  },
  statusContentSlot: {
    width: '100%',
  },
  contentRegion: {
    width: '100%',
  },
  continuousContent: {
    gap: Size.space.text.section,
  },
  hiddenContentSlot: {
    opacity: 0,
    width: 0,
    height: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
});

export const SpeciesEnvironmentSection = React.memo(
  SpeciesEnvironmentSectionComponent,
);
SpeciesEnvironmentSection.displayName = 'SpeciesEnvironmentSection';
