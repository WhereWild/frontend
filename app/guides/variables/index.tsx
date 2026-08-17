// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PageScrollContainer, PageTitle, ThemedText } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { RoutePressable } from '@/components/navigation/RoutePressable';
import {
  getFamilyLabel,
  groupVariablesByFamily,
  normalizeLabel,
  pickFamilyRepresentative,
} from '@/components/sections/speciesEnvironment/model';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import { useLayoutChrome } from '@/context/LayoutChromeContext';
import { fetchEnvironmentVariables } from '@/data/api';
import type { EnvironmentVariableDefinition } from '@/data/types';
import { useResponsive } from '@/hooks/useResponsive';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { anchorScrollMarginStyle, slugifySection } from '@/utils/anchors';
import { WebMetadata } from '@/utils/webMetadata';

type VariableFamilyEntry = {
  key: string;
  label: string;
  category: string | null;
};

/** Consolidates temporal-window/grouped-agg variants (see
 * getVariableFamilyKey) into one listing entry per conceptual variable. */
const toFamilyEntries = (
  variables: EnvironmentVariableDefinition[],
): VariableFamilyEntry[] =>
  [...groupVariablesByFamily(variables).entries()].map(([key, variants]) => {
    const representative = pickFamilyRepresentative(variants);
    return {
      key,
      label: getFamilyLabel(representative, key),
      category: representative.category ?? null,
    };
  });

const groupByCategory = (entries: VariableFamilyEntry[]) => {
  const groups = new Map<string, VariableFamilyEntry[]>();
  for (const entry of entries) {
    const key = entry.category ?? 'other';
    const existing = groups.get(key) ?? [];
    existing.push(entry);
    groups.set(key, existing);
  }
  for (const groupEntries of groups.values()) {
    groupEntries.sort((a, b) => a.label.localeCompare(b.label));
  }
  // Category order follows first-encounter order in the backend's /variables
  // response (itself driven by config/gis/catalog.json's category order) —
  // not alphabetical.
  return [...groups.entries()];
};

export default function VariableGuidesIndexScreen() {
  const responsive = useResponsive();
  const { webHeaderHeight } = useLayoutChrome();
  const [variables, setVariables] = React.useState<
    EnvironmentVariableDefinition[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    fetchEnvironmentVariables()
      .then((fetched) => {
        if (!cancelled) setVariables(fetched);
      })
      .catch(() => {
        // Non-critical listing page; leave empty on failure.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const groupedVariables = React.useMemo(
    () => groupByCategory(toFamilyEntries(variables)),
    [variables],
  );
  // Lets links to this page target a specific category, e.g.
  // /guides/variables#terrain — shared across every category heading in
  // this render pass so repeated category names still de-dupe.
  const categorySlugs = React.useMemo(() => {
    const seenSlugs = new Map<string, number>();
    return new Map(
      groupedVariables.map(([category]) => [
        category,
        slugifySection(normalizeLabel(category), seenSlugs),
      ]),
    );
  }, [groupedVariables]);
  const scrollMarginStyle =
    Platform.OS === 'web'
      ? anchorScrollMarginStyle(webHeaderHeight, responsive.breakpoint)
      : undefined;
  useScrollToHash([groupedVariables]);

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Variable Guides'
          description='Browse guides for every environmental variable used throughout WhereWild.'
          path='/guides/variables'
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
          {Platform.OS === 'web' ? <PageTitle title='Variable Guides' /> : null}

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
              ) : (
                groupedVariables.map(([category, categoryEntries]) => (
                  <View key={category} style={styles.section}>
                    <ThemedText
                      variant='subheading'
                      {...(Platform.OS === 'web'
                        ? {
                            nativeID: categorySlugs.get(category),
                            style: scrollMarginStyle,
                          }
                        : {})}
                    >
                      {normalizeLabel(category)}
                    </ThemedText>
                    <View style={styles.linkList}>
                      {categoryEntries.map((entry) => (
                        <RoutePressable
                          key={entry.key}
                          href={`/guides/variables/${entry.key}`}
                          accessibilityRole='link'
                        >
                          <ThemedText variant='link'>{entry.label}</ThemedText>
                        </RoutePressable>
                      ))}
                    </View>
                  </View>
                ))
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
  linkList: {
    gap: Size.space.text.line,
  },
});
