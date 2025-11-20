import { Colors, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

const createTypographyStyles = (palette: typeof Colors.light) =>
  StyleSheet.create({
    titleHero: {
      ...Typography.titleHero,
      color: palette.text.brand.default,
    },
    titlePage: {
      ...Typography.titlePage,
      color: palette.text.brand.default,
    },
    subtitle: {
      ...Typography.subtitle,
      color: palette.text.brand.secondary,
    },
    heading: {
      ...Typography.heading,
      color: palette.text.default.default,
    },
    subheading: {
      ...Typography.subheading,
      color: palette.text.default.default,
    },
    body: {
      ...Typography.body,
      color: palette.text.default.default,
    },
    bodyStrong: {
      ...Typography.bodyStrong,
      color: palette.text.default.default,
    },
    link: {
        ...Typography.link,
        color: palette.text.default.default,
    },
    code: {
      ...Typography.code,
      color: palette.text.default.default,
    },
    singleLineBody: {
      ...Typography.singleLineBody,
      color: palette.text.default.default,
    },
  });

export const useTypographyStyles = () => {
  const colorScheme = useColorScheme();
  const palette = Colors[colorScheme ?? 'light'];

  return useMemo(() => createTypographyStyles(palette), [palette]);
};
