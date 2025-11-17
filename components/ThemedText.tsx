import { Text as DefaultText, type TextProps } from 'react-native';
import { useTypographyStyles } from '@/hooks/use-typography-styles';

type Variant = 'titleHero' | 'titlePage' | 'subtitle' | 'body' | 'bodyStrong' | 'link' | 'code';

type ThemedTextProps = TextProps & {
  variant?: Variant;
};

export function ThemedText({ style, variant = 'body', ...otherProps }: ThemedTextProps) {
  const typographyStyles = useTypographyStyles();

  return (
    <DefaultText
      {...otherProps}
      style={[typographyStyles[variant], style]}
    />
  );
}