import { getTypographyForMode, Typography } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

const createTypographyStyles = (tokens: typeof Typography.light) =>
  StyleSheet.create({
    titleHero: tokens.titleHero,
    titlePage: tokens.titlePage,
    subtitle: tokens.subtitle,
    heading: tokens.heading,
    subheading: tokens.subheading,
    body: tokens.body,
    bodyEmphasis: tokens.bodyEmphasis,
    bodyStrong: tokens.bodyStrong,
    bodySmall: tokens.bodySmall,
    bodySmallEmphasis: tokens.bodySmallEmphasis,
    bodySmallStrong: tokens.bodySmallStrong,
    link: tokens.link,
    code: tokens.code,
    singleLineBody: tokens.singleLineBody,
    singleLineBodySmallStrong: tokens.singleLineBodySmallStrong,
  });

export const useTypographyStyles = () => {
  const colorScheme = useColorScheme();
  const responsive = useResponsive();
  const tokens = getTypographyForMode(colorScheme ?? 'light', responsive.rootFontSize || 16);

  return useMemo(() => createTypographyStyles(tokens), [tokens]);
};
