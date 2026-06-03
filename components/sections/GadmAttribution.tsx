// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDataSources } from '@/hooks/useDataSources';
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ThemedText } from '../text/ThemedText';

const GADM_SOURCE_ID = 'gadm';

export function GadmAttribution() {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const dataSources = useDataSources();
  const source = dataSources[GADM_SOURCE_ID] ?? null;

  if (!source) return null;

  const dataPageUrl = source.url || null;
  const licenseUrl = source.license_url ?? null;

  return (
    <View style={styles.row}>
      <ThemedText
        variant='bodySmall'
        style={{ color: palette.text.default.secondary }}
      >
        {`Location boundaries: ${source.name}${dataPageUrl || licenseUrl ? ' ' : ''}`}
      </ThemedText>
      {dataPageUrl ? (
        <ThemedText
          variant='bodySmallLink'
          onPress={() => Linking.openURL(dataPageUrl)}
        >
          {'Data page'}
        </ThemedText>
      ) : null}
      {dataPageUrl && licenseUrl ? (
        <>
          <ThemedText
            variant='bodySmall'
            style={{ color: palette.text.default.secondary }}
          >
            {' · '}
          </ThemedText>
        </>
      ) : null}
      {licenseUrl ? (
        <>
          <ThemedText
            variant='bodySmallLink'
            onPress={() => Linking.openURL(licenseUrl)}
          >
            {'License'}
          </ThemedText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
});
