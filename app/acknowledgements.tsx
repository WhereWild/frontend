// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Markdown, PageScrollContainer, PageTitle } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { SourceEntry } from '@/components/sections/SourceEntry';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import { useDataSources } from '@/hooks/useDataSources';
import { useResponsive } from '@/hooks/useResponsive';
import { useScrollToHash } from '@/hooks/useScrollToHash';
import { Platform, StyleSheet, View } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';
import ACKNOWLEDGEMENTS_CONTENT from '@/content/acknowledgements.md';

export default function AcknowledgementsScreen() {
  const responsive = useResponsive();
  const dataSources = useDataSources();
  const sources = Object.values(dataSources);
  // Lands on a specific citation once sources have loaded, e.g.
  // /acknowledgements#fabdem-v1-2.
  useScrollToHash([sources.length]);

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Acknowledgements'
          description='See the open datasets, tools, and contributors that power WhereWild.'
          path='/acknowledgements'
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
          {Platform.OS === 'web' ? (
            <PageTitle title='Acknowledgements' />
          ) : null}

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
              <View style={styles.section}>
                <Markdown>{ACKNOWLEDGEMENTS_CONTENT}</Markdown>
              </View>
              {sources.length > 0 ? (
                <View style={styles.section}>
                  {sources.map((source) => (
                    <SourceEntry key={source.name} source={source} />
                  ))}
                </View>
              ) : null}
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
    gap: Size.space.text.subsection,
  },
});
