import { getTypographyForMode, Typography } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMemo } from 'react';

const createTypographyStyles = (tokens: typeof Typography.light) =>
  ({
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
    bodySmallLink: tokens.bodySmallLink,
    bodySmallStrong: tokens.bodySmallStrong,
    bodyTiny: tokens.bodyTiny,
    bodyTinyStrong: tokens.bodyTinyStrong,
    link: tokens.link,
    code: tokens.code,
    singleLineBody: tokens.singleLineBody,
    singleLineBodySmall: tokens.singleLineBodySmall,
    singleLineBodySmallStrong: tokens.singleLineBodySmallStrong,
    singleLineBodyTiny: tokens.singleLineBodyTiny,
    singleLineBodyTinyStrong: tokens.singleLineBodyTinyStrong,
  });

export const useTypographyStyles = () => {
  const colorScheme = useColorScheme();
  const responsive = useResponsive();
  const tokens = getTypographyForMode(colorScheme ?? 'light', responsive.rootFontSize || 16);

  return useMemo(() => createTypographyStyles(tokens), [tokens]);
};
