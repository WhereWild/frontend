// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PageScrollContainer, PageTitle, ThemedText } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import type { DataSource } from '@/data/types';
import { useDataSources } from '@/hooks/useDataSources';
import { useResponsive } from '@/hooks/useResponsive';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';

export function SourceEntry({ source }: { source: DataSource }) {
  return (
    <View style={styles.sourceEntry}>
      <View style={styles.sourceHeader}>
        <ThemedText variant='subheading'>
          <ThemedText
            variant='link'
            onPress={() => Linking.openURL(source.url)}
          >
            {source.name}
          </ThemedText>
        </ThemedText>
        <ThemedText variant='bodySmall'>
          {'License: '}
          {source.license_url ? (
            <ThemedText
              variant='bodySmallLink'
              onPress={() => Linking.openURL(source.license_url!)}
            >
              {source.license}
            </ThemedText>
          ) : (
            source.license
          )}
        </ThemedText>
      </View>
      {source.references.length > 0 ? (
        <View style={styles.referenceList}>
          {source.references.map((ref, i) => (
            <ThemedText key={i} variant='bodySmall'>
              {ref.year
                ? `${ref.authors} (${ref.year}). ${ref.title}.`
                : `${ref.authors}. ${ref.title}.`}
              {ref.journal ? ` ${ref.journal}` : ''}
              {ref.volume_issue ? `, ${ref.volume_issue}` : ''}
              {ref.pages ? `, pp. ${ref.pages}` : ''}
              {ref.doi || ref.url ? '. ' : '.'}
              {ref.doi ? (
                <ThemedText
                  variant='bodySmallLink'
                  onPress={() => Linking.openURL(ref.doi!)}
                >
                  {ref.doi}
                </ThemedText>
              ) : ref.url ? (
                <ThemedText
                  variant='bodySmallLink'
                  onPress={() => Linking.openURL(ref.url!)}
                >
                  {ref.url}
                </ThemedText>
              ) : null}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function AcknowledgementsScreen() {
  const responsive = useResponsive();
  const dataSources = useDataSources();
  const sources = Object.values(dataSources);

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
                <ThemedText variant='body'>
                  {
                    'WhereWild is built on top of a number of remarkable open datasets. We are deeply grateful to the researchers and organizations who made their work freely available. WhereWild is and will always be completely free and open source, in compliance with the non-commercial licenses of many of these datasets.'
                  }
                </ThemedText>
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
  sourceEntry: {
    gap: Size.space.text.paragraph,
  },
  sourceHeader: {
    gap: Size.space.text.line,
  },
  referenceList: {
    gap: Size.space.text.paragraph,
    paddingLeft: Size.space['400'],
  },
});
