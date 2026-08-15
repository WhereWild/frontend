// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Size } from '@/constants/theme';
import type { DataSource } from '@/data/types';
import { Linking, StyleSheet, View } from 'react-native';
import { ThemedText } from '../text/ThemedText';

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

const styles = StyleSheet.create({
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
