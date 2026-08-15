// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PageScrollContainer, PageTitle, ThemedText } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { RoutePressable } from '@/components/navigation/RoutePressable';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { Platform, StyleSheet, View } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';

const GUIDE_LINKS = [
  {
    label: 'Variables',
    description: 'Every environmental variable used throughout WhereWild.',
    route: '/guides/variables',
  },
  {
    label: 'Variable Types',
    description: 'Reference for the measurement types variables can be.',
    route: '/guides/variables/types',
  },
] as const;

export default function GuidesIndexScreen() {
  const responsive = useResponsive();

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Guides'
          description='Reference guides for the data and concepts used throughout WhereWild.'
          path='/guides'
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
          {Platform.OS === 'web' ? <PageTitle title='Guides' /> : null}

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
              {GUIDE_LINKS.map((guide) => (
                <View key={guide.route} style={styles.section}>
                  <RoutePressable href={guide.route} accessibilityRole='link'>
                    <ThemedText variant='link'>{guide.label}</ThemedText>
                  </RoutePressable>
                  <ThemedText variant='bodySmall'>
                    {guide.description}
                  </ThemedText>
                </View>
              ))}
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
    gap: Size.space.text.line,
  },
});
