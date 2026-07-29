// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Responsive, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { AspectCompassChart } from './AspectCompassChart';
import { ContinuousInsights } from './ContinuousInsights';
import { DensityChart } from './DensityChart';
import { NominalInsights } from './NominalInsights';
import { PolarDensityChart } from './PolarDensityChart';
import { StackedCategoryBar } from './StackedCategoryBar';
import { TernaryDensityChart } from './TernaryDensityChart';
import { VariableSelectorHeader } from './VariableSelectorHeader';
import {
  DEFAULT_VARIABLE,
  getCompositionAxisLabels,
  isValidHistogramContract,
  isVariableDiscrete,
  type EnvironmentVariableOption,
} from './model';
import { useSpeciesEnvironmentState } from './useSpeciesEnvironmentState';
import { SourceAttribution } from '../SourceAttribution';
import { useDataSources } from '@/hooks/useDataSources';
import { useOptionalSettings } from '@/context/SettingsContext';
import { getCbColor } from '@/components/sections/speciesOccurrenceMap/cbColors';

const SLICEABLE_RANKS = new Set([
  'SPECIES',
  'SUBSPECIES',
  'VARIETY',
  'FORM',
  'SUBVARIETY',
  'SUBFORM',
  'GENUS',
  'FAMILY',
]);

/** Props for rendering the species environment analytics section. */
export type SpeciesEnvironmentSectionProps = {
  /** Taxon ID used to fetch environment statistics. */
  taxonId?: number;
  /** Taxon rank string as returned by the backend (e.g. 'SPECIES', 'GENUS'). */
  taxonRank?: string | null;
  /** True when the taxon exceeds the observation threshold — disables slicing and filtering. */
  largeTaxon?: boolean;
  /** Initial environment variable ID to load. */
  variableId?: string;
  /** Optional environment variable catalog override. */
  variables?: EnvironmentVariableOption[];
  /** Receives catalog numbers highlighted by chart/category selection. */
  onHighlightChange?: (catalogNumbers: (number | string)[]) => void;
  /** Called whenever the selected environment variable metadata changes. */
  onVariableMetaChange?: (meta: EnvironmentVariableOption | null) => void;
  /** Optional geographic filter gid applied to environment requests. */
  locationGid?: string | null;
  /** Optional phenology filter value applied to environment requests. */
  phenology?: string | null;
  /** Optional timestamp range filter (Unix seconds). */
  startTimestamp?: number | null;
  endTimestamp?: number | null;
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
  taxonRank,
  largeTaxon = false,
  variableId = DEFAULT_VARIABLE,
  variables,
  onHighlightChange,
  onVariableMetaChange,
  locationGid,
  phenology,
  startTimestamp,
  endTimestamp,
  units,
  pinnedObservation,
}: SpeciesEnvironmentSectionProps) {
  const slicingEnabled =
    !largeTaxon &&
    (taxonRank == null || SLICEABLE_RANKS.has(taxonRank.toUpperCase()));
  const rankLabel =
    taxonRank == null
      ? 'Species'
      : `${taxonRank.charAt(0).toUpperCase()}${taxonRank.slice(1).toLowerCase()}`;
  const sectionTitle = `${rankLabel} Environment`;

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
    ternaryCompositionDensity: ReturnType<
      typeof useSpeciesEnvironmentState
    >['ternaryCompositionDensity'];
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
    baselineCategoricalDistribution: ReturnType<
      typeof useSpeciesEnvironmentState
    >['baselineCategoricalDistribution'];
    anyFilterActive: boolean;
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
    homePinnedCategoryValue: ReturnType<
      typeof useSpeciesEnvironmentState
    >['homePinnedCategoryValue'];
    homeUnobservedCategory: ReturnType<
      typeof useSpeciesEnvironmentState
    >['homeUnobservedCategory'];
  } | null>(null);
  const stableContentScopeRef = React.useRef('');
  const stableContentScope = `${taxonId ?? ''}|${locationGid ?? ''}|${phenology ?? ''}|${startTimestamp ?? ''}|${endTimestamp ?? ''}|${units ?? ''}`;

  if (stableContentScopeRef.current !== stableContentScope) {
    stableContentScopeRef.current = stableContentScope;
    stableDisplayRef.current = null;
  }

  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const dataSources = useDataSources();

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
    selectedVariableMeta,
    error,
    isCategorical,
    categoricalDistribution,
    baselineCategoricalDistribution,
    selectedCategoryValue,
    setSelectedCategoryValue,
    densityCurve,
    ternaryCompositionDensity,
    summary,
    selectedDensityRange,
    handleDensitySelectionChange,
    showRankContext,
    rankContextOptions,
    selectedRankContext,
    setSelectedRankContext,
    summaryRanks,
    summaryComparisons,
    anyFilterActive,
    pinnedCategoryValue,
    pinnedUnobservedCategory,
    pinnedClassName,
    pinnedValue,
    pinnedLoading,
    homePinValue,
    homePinLoading,
    homePinnedCategoryValue,
    homeUnobservedCategory,
    isCircularVariable,
  } = useSpeciesEnvironmentState({
    taxonId,
    variableId,
    variables,
    onHighlightChange,
    locationGid,
    phenology,
    startTimestamp,
    endTimestamp,
    units,
    pinnedObservation,
    slicingEnabled,
  });

  React.useEffect(() => {
    onVariableMetaChange?.(selectedVariableMeta ?? null);
  }, [selectedVariableMeta, onVariableMetaChange]);

  const settings = useOptionalSettings();
  const cbMode = settings?.cbMode ?? null;

  const cbCategoricalDistribution = React.useMemo(() => {
    if (!cbMode || !categoricalDistribution.length)
      return categoricalDistribution;
    const varId = selectedVariable ?? '';
    return categoricalDistribution.map((cat) => {
      const rawId = cat.value;
      const classId =
        typeof rawId === 'string' && rawId.startsWith('class_')
          ? Number(rawId.slice(6))
          : Number(rawId);
      return {
        ...cat,
        color: getCbColor(varId, classId, cbMode, cat.color ?? '#888888'),
      };
    });
  }, [categoricalDistribution, cbMode, selectedVariable]);

  const cbPinnedUnobservedCategory = React.useMemo(() => {
    if (!cbMode || !pinnedUnobservedCategory?.color)
      return pinnedUnobservedCategory;
    const varId = selectedVariable ?? '';
    const rawId = pinnedUnobservedCategory.value;
    const classId =
      typeof rawId === 'string' && rawId.startsWith('class_')
        ? Number(rawId.slice(6))
        : Number(rawId);
    return {
      ...pinnedUnobservedCategory,
      color: getCbColor(varId, classId, cbMode, pinnedUnobservedCategory.color),
    };
  }, [pinnedUnobservedCategory, cbMode, selectedVariable]);

  const isDiscrete = isVariableDiscrete(selectedVariableMeta);

  const compositionAxisLabels = React.useMemo(
    () => getCompositionAxisLabels(selectedVariableMeta, filteredVariables),
    [selectedVariableMeta, filteredVariables],
  );

  const environmentNoun =
    selectedVariableCategory === 'Recent Weather' ||
    selectedVariableMeta?.valueType?.toLowerCase() === 'nominal'
      ? 'weather'
      : 'environment';

  const effectiveDensityCurve = React.useMemo(() => {
    if (isDiscrete && isValidHistogramContract(stats?.histogram)) {
      return {
        points: stats!.histogram!.bins,
        density: stats!.histogram!.counts,
      };
    }
    return densityCurve ?? null;
  }, [isDiscrete, stats, densityCurve]);

  if (!taxonId) {
    return null;
  }

  const shouldPreservePreviousUi = loading && !stats;
  const shouldClearPreservedUi =
    !loading && (!stats || Boolean(stats?.allObscured));

  if (shouldClearPreservedUi) {
    stableDisplayRef.current = null;
  }

  const showLoading = loading && !stats && !stableDisplayRef.current;
  const showUpdating = loading && !stats && Boolean(stableDisplayRef.current);
  const showError = !loading && Boolean(error);
  const showAllObscured = !loading && Boolean(stats?.allObscured);

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
        categoricalDistribution: cbCategoricalDistribution,
        selectedCategoryValue,
        densityCurve,
        ternaryCompositionDensity,
        summary,
        selectedDensityRange,
        showRankContext,
        rankContextOptions,
        selectedRankContext,
        summaryRanks,
        summaryComparisons,
        baselineCategoricalDistribution,
        anyFilterActive,
        pinnedCategoryValue,
        pinnedUnobservedCategory: cbPinnedUnobservedCategory,
        pinnedClassName,
        pinnedValue,
        homePinnedCategoryValue,
        homeUnobservedCategory,
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
  const isOrdinalVar =
    selectedVariableMeta?.valueType?.toLowerCase() === 'ordinal';
  const showContinuousContent = Boolean(
    displayState && !displayState.isCategorical,
  );
  const numericPinnedValue =
    typeof pinnedValue === 'number' ? pinnedValue : null;
  const numericHomePinValue =
    typeof homePinValue === 'number' ? homePinValue : null;

  return (
    <View collapsable={false} style={styles.container}>
      <ThemedText variant='subheading'>{sectionTitle}</ThemedText>

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
        <View
          collapsable={false}
          testID='species-environment-obscured-slot'
          accessibilityElementsHidden={!showAllObscured}
          importantForAccessibility={
            showAllObscured ? 'auto' : 'no-hide-descendants'
          }
          style={[
            styles.statusContentSlot,
            !showAllObscured && styles.hiddenContentSlot,
          ]}
        >
          <View
            style={[
              styles.obscuredWarning,
              {
                backgroundColor: palette.background.warning.secondary,
                borderColor: palette.border.warning.default,
              },
            ]}
          >
            <ThemedText
              variant='bodySmall'
              style={{ color: palette.text.warning.default }}
            >
              All observations for this species
              {anyFilterActive ? ' matching the active filters' : ''} have
              obscured locations and cannot be used for environmental analysis.
            </ThemedText>
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
          style={[
            !showCategoricalContent ? styles.hiddenContentSlot : undefined,
            styles.categoricalContent,
          ]}
        >
          {selectedVariable === 'aspect' ||
          selectedVariable === 'Aspect (binned)' ? (
            <AspectCompassChart
              categories={displayState?.categoricalDistribution ?? []}
              selectedValue={displayState?.selectedCategoryValue ?? null}
              highlightedValue={displayState?.pinnedCategoryValue ?? null}
              homeHighlightedValue={
                displayState?.homePinnedCategoryValue ?? null
              }
              unobservedHighlightedCategory={
                displayState?.pinnedUnobservedCategory ?? null
              }
              homeUnobservedCategory={
                displayState?.homeUnobservedCategory ?? null
              }
              anyFilterActive={displayState?.anyFilterActive ?? false}
              environmentNoun={environmentNoun}
              onSelect={handleCategorySelect}
              descriptionColor={palette.text.default.secondary}
              fillColor={palette.background.brand.default}
              selectedFillColor={palette.background.brand.default}
              highlightOutlineColor='#F59E0B'
              homeHighlightOutlineColor={palette.background.brand.default}
            />
          ) : (
            <>
              {displayState?.ternaryCompositionDensity &&
                compositionAxisLabels && (
                  <TernaryDensityChart
                    density={displayState.ternaryCompositionDensity}
                    axisLabels={compositionAxisLabels}
                    fillColor={palette.background.brand.default}
                    contourColor={palette.border.default.secondary}
                    textColor={palette.text.default.secondary}
                    legendClasses={selectedVariableMeta?.legendClasses ?? null}
                  />
                )}
              <StackedCategoryBar
                categories={displayState?.categoricalDistribution ?? []}
                selectedValue={displayState?.selectedCategoryValue ?? null}
                pinnedValue={displayState?.pinnedValue ?? null}
                pinnedClassName={displayState?.pinnedClassName ?? null}
                highlightedValue={displayState?.pinnedCategoryValue ?? null}
                homeHighlightedValue={
                  displayState?.homePinnedCategoryValue ?? null
                }
                unobservedHighlightedCategory={
                  displayState?.pinnedUnobservedCategory ?? null
                }
                homeUnobservedCategory={
                  displayState?.homeUnobservedCategory ?? null
                }
                anyFilterActive={displayState?.anyFilterActive ?? false}
                environmentNoun={environmentNoun}
                onSelect={handleCategorySelect}
                descriptionColor={palette.text.default.secondary}
                highlightOutlineColor='#F59E0B'
                homeHighlightOutlineColor={palette.background.brand.default}
                variableId={selectedVariable ?? undefined}
                shapesEnabled={settings?.shapesEnabled ?? false}
                markerOutlineEnabled={settings?.markerOutlineEnabled ?? false}
                preserveOrder={isOrdinalVar}
              />
            </>
          )}
          {typeof displayState?.summary?.unique_classes === 'number' &&
            (() => {
              return (
                <NominalInsights
                  showRankContext={displayState?.showRankContext ?? false}
                  rankContextOptions={displayState?.rankContextOptions ?? []}
                  selectedRankContext={
                    displayState?.selectedRankContext ?? null
                  }
                  onRankContextChange={handleRankContextChange}
                  isOrdinal={isOrdinalVar}
                  summary={displayState?.summary}
                  summaryRanks={{
                    unique_classes:
                      displayState?.summaryRanks?.unique_classes ?? null,
                    entropy: displayState?.summaryRanks?.entropy ?? null,
                    mode_class: displayState?.summaryRanks?.mode_class ?? null,
                    selected_class:
                      displayState?.summaryRanks?.selected_class ?? null,
                    q10: displayState?.summaryRanks?.q10 ?? null,
                    q25: displayState?.summaryRanks?.q25 ?? null,
                    median: displayState?.summaryRanks?.median ?? null,
                    q75: displayState?.summaryRanks?.q75 ?? null,
                    q90: displayState?.summaryRanks?.q90 ?? null,
                  }}
                  summaryComparisons={displayState?.summaryComparisons ?? {}}
                  baselineCategoricalDistribution={
                    displayState?.baselineCategoricalDistribution ?? null
                  }
                  categoricalDistribution={
                    displayState?.categoricalDistribution ?? []
                  }
                  selectedCategoryValue={
                    displayState?.selectedCategoryValue ?? null
                  }
                  anyFilterActive={anyFilterActive}
                />
              );
            })()}
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
            <>
              <PolarDensityChart
                curve={displayState?.densityCurve}
                fillColor={palette.background.brand.default}
                lineColor={palette.background.brand.default}
                guideColor={palette.text.default.secondary}
                selection={displayState?.selectedDensityRange ?? null}
                onSelectionChange={
                  slicingEnabled ? handleDensitySelectionChange : undefined
                }
                pinValue={numericPinnedValue}
                pinLoading={pinnedLoading}
                homePinValue={numericHomePinValue}
                homePinLoading={homePinLoading}
                homePinColor={palette.background.brand.default}
                circularMean={
                  typeof displayState?.summary?.circular_mean === 'number'
                    ? displayState.summary.circular_mean
                    : null
                }
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
                    rbar: null,
                    circular_std: null,
                  }
                }
                summaryComparisons={displayState?.summaryComparisons ?? {}}
                anyFilterActive={displayState?.anyFilterActive ?? false}
                valueType='circular'
              />
            </>
          ) : (
            <>
              <DensityChart
                curve={effectiveDensityCurve}
                lineColor={palette.background.brand.default}
                fillColor={palette.background.brand.default}
                baselineColor={palette.border.neutral.default}
                summary={displayState?.summary}
                selection={displayState?.selectedDensityRange ?? null}
                onSelectionChange={
                  slicingEnabled ? handleDensitySelectionChange : undefined
                }
                pinValue={numericPinnedValue}
                pinLoading={pinnedLoading}
                homePinValue={numericHomePinValue}
                homePinLoading={homePinLoading}
                anyFilterActive={anyFilterActive}
                temporalFilterActive={
                  selectedVariableCategory === 'Recent Weather'
                }
                isDiscrete={isDiscrete}
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
                anyFilterActive={displayState?.anyFilterActive ?? false}
              />
            </>
          )}
        </View>

        {selectedVariableMeta?.sourceIds &&
          selectedVariableMeta.sourceIds.length > 0 && (
            <SourceAttribution
              sourceIds={selectedVariableMeta.sourceIds}
              dataSources={dataSources}
            />
          )}
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
  obscuredWarning: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    paddingHorizontal: Size.space['200'],
    paddingVertical: Size.space['100'],
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
    gap: Size.space.text.paragraph,
  },
  categoricalContent: {
    gap: Size.space.text.section,
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
