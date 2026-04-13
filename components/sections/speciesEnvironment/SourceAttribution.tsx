import { Colors, Size } from '@/constants/theme';
import type { DataSource } from '@/data/types';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';

type SourceAttributionProps = {
  sourceIds: string[];
  dataSources: Record<string, DataSource>;
};

export function SourceAttribution({
  sourceIds,
  dataSources,
}: SourceAttributionProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const resolved = sourceIds
    .map((id) => ({ id, source: dataSources[id] }))
    .filter((entry): entry is { id: string; source: DataSource } =>
      Boolean(entry.source),
    );

  if (resolved.length === 0) return null;

  return (
    <View style={styles.container}>
      {resolved.map(({ id, source }) => {
        const ref = source.references[0];
        const doiUrl = ref?.doi ?? null;
        const dataPageUrl = source.url ?? null;
        return (
          <View key={id} style={styles.row}>
            <ThemedText
              variant='bodySmall'
              style={{ color: palette.text.default.secondary }}
            >
              {`Source: ${source.name}${doiUrl || dataPageUrl ? ' ' : ''}`}
            </ThemedText>
            {doiUrl ? (
              <ThemedText
                variant='bodySmallLink'
                onPress={() => Linking.openURL(doiUrl)}
              >
                {'DOI'}
              </ThemedText>
            ) : null}
            {doiUrl && dataPageUrl ? (
              <ThemedText
                variant='bodySmall'
                style={{ color: palette.text.default.secondary }}
              >
                {' · '}
              </ThemedText>
            ) : null}
            {dataPageUrl ? (
              <ThemedText
                variant='bodySmallLink'
                onPress={() => Linking.openURL(dataPageUrl)}
              >
                {'Data page'}
              </ThemedText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Size.space.text.line,
    marginTop: Size.space['200'],
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
});
