// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { DetectedValueType } from './dataTypeDetection';
import type { RasterMetadata } from './rasterMetadata';

const VALUE_TYPE_LABELS: Record<DetectedValueType['guess'], string> = {
  nominal: 'Nominal (unordered categories)',
  ordinal: 'Ordinal (ranked categories)',
  interval: 'Interval (no true zero)',
  ratio: 'Ratio (true zero)',
  circular: 'Circular (angle/bearing)',
};

const fmt = (v: number): string => {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(4);
  return String(Math.round(v * 1e6) / 1e6);
};

export function MetadataPanel({
  metadata,
  detectedType,
}: {
  metadata: RasterMetadata;
  detectedType?: DetectedValueType | null;
}) {
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const rows: [string, string][] = [
    ['Dimensions', `${metadata.width} × ${metadata.height} px`],
    ['Bands', `${metadata.bandCount} (${metadata.dtype})`],
    ['Compression', metadata.compression],
    [
      'Tiling',
      metadata.tiled
        ? `${metadata.tileWidth} × ${metadata.tileHeight} px`
        : 'Stripped (not tiled)',
    ],
    [
      'Overviews',
      metadata.overviews.length
        ? metadata.overviews.map((o) => `${o.width}×${o.height}`).join(', ')
        : 'None',
    ],
    ['CRS', metadata.crsLabel],
    [
      'Pixel size',
      metadata.resolution
        ? `${fmt(metadata.resolution[0])}, ${fmt(metadata.resolution[1])}`
        : '—',
    ],
    ['Extent', metadata.bbox ? metadata.bbox.map(fmt).join(', ') : '—'],
    ['NoData', metadata.noData == null ? 'Not set' : fmt(metadata.noData)],
    ['BigTIFF', metadata.bigTiff ? 'Yes' : 'No'],
  ];

  const isCog = metadata.cog.isCog;

  return (
    <View style={styles.container} testID='gis-metadata-panel'>
      <ThemedText variant='subheading'>File metadata</ThemedText>
      <View style={styles.table}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <ThemedText variant='bodySmall' style={styles.rowLabel}>
              {label}
            </ThemedText>
            <ThemedText variant='bodySmall' style={styles.rowValue}>
              {value}
            </ThemedText>
          </View>
        ))}
      </View>

      {detectedType ? (
        <View
          style={[
            styles.callout,
            {
              backgroundColor: palette.background.default.secondary,
              borderColor: palette.border.default.secondary,
            },
          ]}
        >
          <ThemedText variant='bodyEmphasis'>
            {`Suggested data type: ${VALUE_TYPE_LABELS[detectedType.guess]}`}
          </ThemedText>
          <ThemedText
            variant='bodyTiny'
            style={{ color: palette.text.default.secondary }}
          >
            {`${detectedType.confidence} confidence — ${detectedType.reason}`}
          </ThemedText>
        </View>
      ) : null}

      <View
        style={[
          styles.callout,
          {
            backgroundColor: isCog
              ? palette.background.default.secondary
              : palette.background.warning.secondary,
            borderColor: isCog
              ? palette.border.default.secondary
              : palette.border.warning.default,
          },
        ]}
      >
        <ThemedText
          variant='bodyEmphasis'
          style={{
            color: isCog
              ? palette.text.default.default
              : palette.text.warning.default,
          }}
        >
          {isCog
            ? 'Valid Cloud-Optimized GeoTIFF'
            : 'Not a valid Cloud-Optimized GeoTIFF'}
        </ThemedText>
        {metadata.cog.checks.map((check) => (
          <View key={check.label} style={styles.checkRow}>
            <ThemedText variant='bodySmall' style={styles.checkMark}>
              {check.pass == null ? '–' : check.pass ? '✓' : '✕'}
            </ThemedText>
            <View style={styles.checkText}>
              <ThemedText variant='bodySmall'>{check.label}</ThemedText>
              <ThemedText
                variant='bodyTiny'
                style={{ color: palette.text.default.secondary }}
              >
                {check.detail}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Size.space['300'] },
  table: { gap: Size.space['100'] },
  row: {
    flexDirection: 'row',
    gap: Size.space['200'],
    alignItems: 'flex-start',
  },
  rowLabel: { width: 108, flexShrink: 0, opacity: 0.7 },
  rowValue: { flex: 1 },
  callout: {
    borderWidth: 1,
    borderRadius: Size.radius['200'],
    padding: Size.space['300'],
    gap: Size.space['200'],
  },
  checkRow: { flexDirection: 'row', gap: Size.space['200'] },
  checkMark: { width: 14, flexShrink: 0 },
  checkText: { flex: 1, gap: 2 },
});
