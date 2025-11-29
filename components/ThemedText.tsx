import { Text as DefaultText, type TextProps } from 'react-native';
import { useTypographyStyles } from '@/hooks/useTypographyStyles';

type TypographyVariants = keyof ReturnType<typeof useTypographyStyles>;

type ThemedTextProps = TextProps & {
  variant?: TypographyVariants;
};

export function ThemedText({ style, variant = 'body', ...otherProps }: ThemedTextProps) {
  const typographyStyles = useTypographyStyles();
  const resolvedVariant = typographyStyles[variant] ? variant : 'body';

  if (__DEV__ && variant !== resolvedVariant) {
    console.warn(`ThemedText: unknown variant "${String(variant)}". Falling back to "body".`);
  }

  return (
    <DefaultText
      {...otherProps}
      style={[typographyStyles[resolvedVariant], style]}
    />
  );
}