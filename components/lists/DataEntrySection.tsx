import { Size } from '@/constants/theme';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ThemedText } from '../text/ThemedText';
import { DataEntry, type DataEntryProps } from './DataEntry';

export type DataEntrySectionEntry = Omit<DataEntryProps, 'style'>;

export type DataEntrySectionProps = {
  title?: string;
  entries?: DataEntrySectionEntry[];
  style?: StyleProp<ViewStyle>;
};

export function DataEntrySection({
  title = 'Section Title',
  entries = [],
  style,
}: DataEntrySectionProps) {
  return (
    <View style={[styles.section, style]}>
      <ThemedText variant="heading" style={styles.heading}>{title}</ThemedText>
      <View style={styles.entries}>
        {entries.map((entry, index) => (
          <DataEntry
            key={`${entry.dataName}-${entry.dataPoint}-${index}`}
            {...entry}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
  },
  heading: {
    paddingLeft: Size.space['100'],
  },
  entries: {
    width: '100%',
  },
});
