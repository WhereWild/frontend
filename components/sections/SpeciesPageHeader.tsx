import { IconDownload } from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Button } from '../buttons/Button';
import { ThemedText } from '../text/ThemedText';

export type SpeciesPageHeaderProps = {
  commonName: string;
  scientificName: string;
  onPressDownload?: () => void;
  downloadLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function SpeciesPageHeader({
  commonName,
  scientificName,
  downloadLabel = 'Download',
  onPressDownload,
  style,
}: SpeciesPageHeaderProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.background.default.default,
          paddingHorizontal: responsive.marginHorizontal,
        },
        style,
      ]}
    >
      <View style={[styles.content, { maxWidth: responsive.contentWidth }]}>
        <View style={styles.headingRow}>
          <ThemedText variant="titlePage">
            {commonName}
          </ThemedText>
          <Button
            variant="neutral"
            iconStart={<IconDownload />}
            onPress={onPressDownload}
            accessibilityLabel={`${downloadLabel} ${commonName}`}
          >
            {downloadLabel}
          </Button>
        </View>
        <ThemedText variant="bodyEmphasis">
          {scientificName}
        </ThemedText>
        <View
          style={[
            styles.divider,
            {
              backgroundColor: palette.border.brand.secondary,
            },
          ]}
          testID="species-page-header-divider"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',

  },
  content: {
    width: '100%',

    alignSelf: 'center',
    gap: Size.space['200'],
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    height: Size.stroke.border,
    width: '100%',
  },
});
