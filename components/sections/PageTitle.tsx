import { Button, ButtonProps } from '../buttons/Button';
import { IconButton, IconButtonProps } from '../buttons/IconButton';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ThemedText } from '../text/ThemedText';

export type PageTitleProps = {
  title: string;
  /** When provided, renders an IconButton to the right of the title. */
  iconButton?: IconButtonProps;
  /** When provided, renders a Button to the right of the title. */
  button?: ButtonProps;
  constrainContentWidth?: boolean;
  contentMaxWidth?: number | null;
  style?: StyleProp<ViewStyle>;
};

export function PageTitle({
  title,
  iconButton,
  button,
  constrainContentWidth = true,
  contentMaxWidth,
  style,
}: PageTitleProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const resolvedMaxWidth =
    contentMaxWidth === undefined
      ? constrainContentWidth
        ? responsive.textWidth
        : null
      : contentMaxWidth;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: palette.background.default.default },
        getResponsiveContentContainerStyle(responsive, {
          includeWidth: false,
          includeTopPadding: false,
        }),
        style,
      ]}
    >
      <View
        style={[
          styles.content,
          resolvedMaxWidth != null && { maxWidth: resolvedMaxWidth },
        ]}
      >
        <View style={styles.headingRow}>
          <ThemedText variant='titlePage'>{title}</ThemedText>
          {(iconButton != null || button != null) && (
            <View style={styles.buttons}>
              {iconButton != null && <IconButton {...iconButton} />}
              {button != null && <Button {...button} />}
            </View>
          )}
        </View>
        <View
          style={[
            styles.divider,
            { backgroundColor: palette.border.brand.secondary },
          ]}
          testID='page-title-divider'
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
    flexWrap: 'wrap',
    gap: Size.space['200'],
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
    flexShrink: 0,
  },
  divider: {
    height: Size.stroke.border,
    width: '100%',
  },
});
