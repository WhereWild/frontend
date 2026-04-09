import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  DataEntrySection,
  type DataEntrySectionEntry,
} from './DataEntrySection';

export type InlineExpandableRowEntry = DataEntrySectionEntry;

export type InlineExpandableRowsSection = {
  title: string;
  entries: InlineExpandableRowEntry[];
};

export type InlineExpandableRowsProps = {
  sections?: InlineExpandableRowsSection[];
  style?: StyleProp<ViewStyle>;
};

export function InlineExpandableRows({
  sections = [],
  style,
}: InlineExpandableRowsProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background.default.secondary,
        },
        style,
      ]}
    >
      {sections.map((section, index) => (
        <DataEntrySection
          // TODO: replace title+index key with a stable unique identifier once sections expose one
          key={`${section.title}-${index}`}
          title={section.title}
          entries={section.entries}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: Size.radius['200'],
    padding: Size.space['400'],
    gap: Size.space['400'],
  },
});
