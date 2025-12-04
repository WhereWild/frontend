import { IconDownload } from '@/assets/icons';
import { Colors, Responsive, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useIsCompact } from '@/hooks/useResponsive';
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
  const isCompact = useIsCompact();
  const dividerStyle = [
    styles.divider,
    {
      backgroundColor: palette.border.brand.secondary,
    },
  ];

  const downloadButton = (
    <Button
      variant="neutral"
      iconStart={<IconDownload />}
      onPress={onPressDownload}
      accessibilityLabel={`${downloadLabel} ${commonName}`}
      size={isCompact ? 'small' : 'medium'}
      style={isCompact ? styles.mobileButton : undefined}
    >
      {downloadLabel}
    </Button>
  );

  return (
    <View
      testID={`species-page-header-${isCompact ? 'mobile' : 'desktop'}`}
      style={[
        styles.container,
        {
          backgroundColor: palette.background.default.default,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {isCompact ? (
          <>
            <View style={styles.mobileHeadingGroup}>
              <ThemedText variant="titlePage">
                {commonName}
              </ThemedText>
              <ThemedText variant="bodyEmphasis">
                {scientificName}
              </ThemedText>
            </View>
            {downloadButton}
            <View style={dividerStyle} testID="species-page-header-divider" />
          </>
        ) : (
          <>
            <View style={styles.headingRow}>
              <ThemedText variant="titlePage">
                {commonName}
              </ThemedText>
              {downloadButton}
            </View>
            <ThemedText variant="bodyEmphasis">
              {scientificName}
            </ThemedText>
            <View style={dividerStyle} testID="species-page-header-divider" />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Responsive.marginHorizontal, // Pending mobile spec: rely on desktop spacing for now
  },
  content: {
    width: '100%',
    maxWidth: Responsive.contentWidth,
    alignSelf: 'center',
    gap: Size.space['200'],
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileHeadingGroup: {
    gap: Size.space['050'],
    alignSelf: 'stretch',
  },
  mobileButton: {
    alignSelf: 'flex-start',
  },
  divider: {
    height: Size.stroke.border,
    width: '100%',
  },
});
