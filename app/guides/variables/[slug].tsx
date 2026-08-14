// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Markdown,
  PageScrollContainer,
  PageTitle,
  ThemedText,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { RoutePressable } from '@/components/navigation/RoutePressable';
import { SourceEntry } from '@/components/sections/SourceEntry';
import {
  getCbColor,
  getCbShape,
} from '@/components/sections/speciesOccurrenceMap/cbColors';
import { ShapeMarker } from '@/components/sections/speciesOccurrenceMap/ShapeMarker';
import {
  normalizeLabel,
  formatValue,
  getApiIdDisplay,
  getFamilyLabel,
  groupVariablesByFamily,
  isVariableCategorical,
  isVariableCircular,
  pickFamilyRepresentative,
} from '@/components/sections/speciesEnvironment/model';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Colors, Size } from '@/constants/theme';
import { isVariableTypeKey } from '@/constants/variableTypes';
import { useSettings } from '@/context/SettingsContext';
import { fetchEnvironmentVariables } from '@/data/api';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDataSources } from '@/hooks/useDataSources';
import { useResponsive } from '@/hooks/useResponsive';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';
import { VARIABLE_GUIDES } from '@/content/guides/variables/index';

const NO_GUIDE_YET_CONTENT = 'More coming soon.';

/** Matches an `## ClassName` heading — see scaffold-variable-guide.mjs,
 * which generates one such heading per legend class. */
const CLASS_HEADING_PATTERN = /^##\s+(.+)$/gm;

/** Splits guide markdown into the free-form intro (everything before the
 * first `## ` heading) and a class-name -> body map for each `## ` section,
 * so per-class prose renders alongside that class's color swatch in the
 * Categories list below, instead of as a second, disconnected listing of
 * bare headings up top. */
function splitGuideContentByClass(content: string): {
  intro: string;
  classSections: Map<string, string>;
} {
  const classSections = new Map<string, string>();
  const matches = [...content.matchAll(CLASS_HEADING_PATTERN)];
  if (matches.length === 0) {
    return { intro: content, classSections };
  }
  const intro = content.slice(0, matches[0].index).trim();
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const name = match[1].trim();
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : content.length;
    classSections.set(name, content.slice(start, end).trim());
  }
  return { intro, classSections };
}

type VariableGuideRouteParams = {
  slug?: string;
};

export default function VariableGuideScreen() {
  const params = useLocalSearchParams<VariableGuideRouteParams>();
  const slug = typeof params.slug === 'string' ? params.slug : '';
  const responsive = useResponsive();
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const dataSources = useDataSources();
  const { units, colormap, cbMode } = useSettings();

  const [variable, setVariable] =
    React.useState<EnvironmentVariableDefinition | null>(null);
  const [apiIdDisplay, setApiIdDisplay] = React.useState<string | null>(null);
  const [compositionMembers, setCompositionMembers] = React.useState<
    EnvironmentVariableDefinition[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);

    fetchEnvironmentVariables({ units })
      .then((variables) => {
        if (cancelled) return;
        const variants = groupVariablesByFamily(variables).get(slug) ?? null;
        const found = variants ? pickFamilyRepresentative(variants) : null;
        setVariable(found);
        setApiIdDisplay(variants ? getApiIdDisplay(variants) : null);
        setNotFound(!found);
        setCompositionMembers(
          found?.compositionGroup
            ? variables.filter(
                (v) =>
                  v.compositionGroup === found.compositionGroup &&
                  v.id !== found.id,
              )
            : [],
        );
      })
      .catch(() => {
        if (cancelled) return;
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, units]);

  const isOrdinalVariable = variable?.valueType?.toLowerCase() === 'ordinal';
  const legendColorMode = isOrdinalVariable ? (colormap ?? 'viridis') : cbMode;
  const useShapes = cbMode === 'achromatopsia';

  const label = variable
    ? getFamilyLabel(variable, slug)
    : slug
      ? normalizeLabel(slug)
      : 'Variable';
  const guideContent = VARIABLE_GUIDES[slug] ?? NO_GUIDE_YET_CONTENT;
  const { intro, classSections } = React.useMemo(
    () => splitGuideContentByClass(guideContent),
    [guideContent],
  );
  const sources = (variable?.sourceIds ?? [])
    .map((id) => dataSources[id])
    .filter((source): source is NonNullable<typeof source> => Boolean(source));

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title={`WhereWild | ${label} Guide`}
          description={`Learn about the ${label} environmental variable used throughout WhereWild.`}
          path={`/guides/variables/${slug}`}
        />
      ) : null}
      <PageSurface>
        <PageScrollContainer
          contentContainerStyle={getResponsiveContentContainerStyle(
            responsive,
            {
              includeHorizontalPadding: false,
              includeBottomPadding: true,
              includeGap: true,
            },
          )}
          bounces={false}
        >
          {Platform.OS === 'web' ? <PageTitle title={label} /> : null}

          <View
            style={[
              styles.contentShell,
              getResponsiveContentContainerStyle(responsive, {
                includeWidth: false,
                includeTopPadding: false,
              }),
            ]}
          >
            <View style={[styles.content, { maxWidth: responsive.textWidth }]}>
              {isLoading ? (
                <ActivityIndicator />
              ) : notFound ? (
                <ThemedText variant='body'>
                  {"We couldn't find that variable."}
                </ThemedText>
              ) : (
                <>
                  <View style={styles.section}>
                    <Markdown>{intro}</Markdown>
                  </View>

                  <View style={styles.section}>
                    <ThemedText variant='subheading'>{'Details'}</ThemedText>
                    <View style={styles.statRow}>
                      <ThemedText
                        variant='bodySmall'
                        style={{ color: palette.text.default.secondary }}
                      >
                        {'API ID'}
                      </ThemedText>
                      <ThemedText variant='bodySmall'>
                        {apiIdDisplay ?? '—'}
                      </ThemedText>
                    </View>
                    {(variable?.rawValueType ?? variable?.valueType) ? (
                      <View style={styles.statRow}>
                        <ThemedText
                          variant='bodySmall'
                          style={{ color: palette.text.default.secondary }}
                        >
                          {'Variable type'}
                        </ThemedText>
                        {(() => {
                          const displayType =
                            variable!.rawValueType ?? variable!.valueType!;
                          return isVariableTypeKey(
                            displayType.toLowerCase(),
                          ) ? (
                            <RoutePressable
                              href={`/guides/variables/types/${displayType.toLowerCase()}`}
                              accessibilityRole='link'
                            >
                              <ThemedText variant='bodySmallLink'>
                                {normalizeLabel(displayType)}
                              </ThemedText>
                            </RoutePressable>
                          ) : (
                            <ThemedText variant='bodySmall'>
                              {normalizeLabel(displayType)}
                            </ThemedText>
                          );
                        })()}
                      </View>
                    ) : null}
                    {variable?.domain ? (
                      <View style={styles.statRow}>
                        <ThemedText
                          variant='bodySmall'
                          style={{ color: palette.text.default.secondary }}
                        >
                          {'Domain'}
                        </ThemedText>
                        <ThemedText variant='bodySmall'>
                          {normalizeLabel(variable.domain)}
                        </ThemedText>
                      </View>
                    ) : null}
                    <View style={styles.statRow}>
                      <ThemedText
                        variant='bodySmall'
                        style={{ color: palette.text.default.secondary }}
                      >
                        {'Category'}
                      </ThemedText>
                      <ThemedText variant='bodySmall'>
                        {variable?.category
                          ? normalizeLabel(variable.category)
                          : '—'}
                      </ThemedText>
                    </View>
                    {variable?.units ? (
                      <View style={styles.statRow}>
                        <ThemedText
                          variant='bodySmall'
                          style={{ color: palette.text.default.secondary }}
                        >
                          {'Units'}
                        </ThemedText>
                        <ThemedText variant='bodySmall'>
                          {variable.units}
                        </ThemedText>
                      </View>
                    ) : null}
                    {variable?.renderMin != null &&
                    variable?.renderMax != null &&
                    !isVariableCircular(variable) &&
                    !isVariableCategorical(variable) ? (
                      <View style={styles.statRow}>
                        <ThemedText
                          variant='bodySmall'
                          style={{ color: palette.text.default.secondary }}
                        >
                          {'Global range'}
                        </ThemedText>
                        <ThemedText variant='bodySmall'>
                          {`${formatValue(variable.renderMin, 1)} to ${formatValue(variable.renderMax, 1)}${variable.units ? ` ${variable.units}` : ''}`}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>

                  {variable?.compositionGroup &&
                  compositionMembers.length > 0 ? (
                    <View style={styles.section}>
                      <ThemedText variant='subheading'>
                        {'Composition'}
                      </ThemedText>
                      <ThemedText
                        variant='bodySmall'
                        style={{ color: palette.text.default.secondary }}
                      >
                        {variable.compositionAxis
                          ? `Part of the ${normalizeLabel(variable.compositionGroup)} composition, alongside:`
                          : `Classifies the composition of:`}
                      </ThemedText>
                      <View style={styles.linkList}>
                        {compositionMembers.map((member) => (
                          <RoutePressable
                            key={member.id}
                            href={`/guides/variables/${member.id}`}
                            accessibilityRole='link'
                          >
                            <ThemedText variant='link'>
                              {member.compositionLabel ??
                                member.name ??
                                normalizeLabel(member.id)}
                            </ThemedText>
                          </RoutePressable>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {variable?.legendClasses &&
                  variable.legendClasses.length > 0 ? (
                    <View style={styles.section}>
                      <ThemedText variant='subheading'>
                        {'Categories'}
                      </ThemedText>
                      <View style={styles.legendList}>
                        {variable.legendClasses.map((legendClass) => {
                          const classColor = getCbColor(
                            variable.id,
                            Number(legendClass.id),
                            legendColorMode,
                            legendClass.color ?? '#888888',
                          );
                          const classBody = classSections.get(legendClass.name);
                          return (
                            <View
                              key={legendClass.id}
                              style={styles.legendItem}
                            >
                              <View style={styles.legendRow}>
                                {useShapes ? (
                                  <View
                                    testID={`legend-swatch-${legendClass.id}`}
                                  >
                                    <ShapeMarker
                                      shape={getCbShape(
                                        variable.id,
                                        Number(legendClass.id),
                                      )}
                                      color={classColor}
                                      size={16}
                                    />
                                  </View>
                                ) : (
                                  <View
                                    testID={`legend-swatch-${legendClass.id}`}
                                    style={[
                                      styles.legendSwatch,
                                      { backgroundColor: classColor },
                                    ]}
                                  />
                                )}
                                <ThemedText variant='bodySmall'>
                                  {legendClass.name}
                                </ThemedText>
                              </View>
                              {classBody ? (
                                <View style={styles.legendBody}>
                                  <Markdown>{classBody}</Markdown>
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}

                  {sources.length > 0 ? (
                    <View style={styles.section}>
                      <ThemedText variant='subheading'>{'Sources'}</ThemedText>
                      {sources.map((source) => (
                        <SourceEntry key={source.name} source={source} />
                      ))}
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </View>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  contentShell: {
    width: '100%',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    gap: Size.space.text.section,
  },
  section: {
    gap: Size.space.text.paragraph,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendList: {
    gap: Size.space.text.paragraph,
  },
  linkList: {
    gap: Size.space.text.line,
  },
  legendItem: {
    gap: Size.space.text.line,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  legendSwatch: {
    width: Size.space['400'],
    height: Size.space['400'],
    borderRadius: Size.radius['100'],
  },
  legendBody: {
    paddingLeft: Size.space['600'],
  },
});
