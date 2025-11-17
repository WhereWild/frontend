import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

const createTypographyStyles = (
  palette: typeof Colors.light,
  tokens: typeof Typography.light,
) =>
  StyleSheet.create({
    titleHero: {
      ...tokens.titleHero,
      color: palette.text.brand.default,
    },
    titlePage: {
      ...tokens.titlePage,
      color: palette.text.brand.default,
    },
    subtitle: {
      ...tokens.subtitle,
      color: palette.text.brand.secondary,
    },
    heading: {
      ...tokens.heading,
      color: palette.text.default.default,
    },
    subheading: {
      ...tokens.subheading,
      color: palette.text.default.default,
    },
    body: {
      ...tokens.body,
      color: palette.text.default.default,
    },
    bodyStrong: {
      ...tokens.bodyStrong,
      color: palette.text.default.default,
    },
    link: {
      ...tokens.link,
      color: palette.text.default.default,
    },
    code: {
      ...tokens.code,
      color: palette.text.default.default,
    },
    singleLineBody: {
      ...tokens.singleLineBody,
      color: palette.text.default.default,
    },
  });

export const useTypographyStyles = () => {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];
  const tokens = Typography[colorScheme ?? 'light'];

  return useMemo(() => createTypographyStyles(palette, tokens), [palette, tokens]);
};
