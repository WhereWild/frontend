import { Text as DefaultText, type TextProps } from 'react-native';
import { useTypographyStyles } from '@/hooks/use-typography-styles';

type ThemedTextProps = TextProps & {
  type?: 'titleHero' | 'titlePage' | 'subtitle' | 'body' | 'bodyStrong' | 'link' | 'code';
};

export function ThemedText({ style, type = 'body', ...otherProps }: ThemedTextProps) {
  const typographyStyles = useTypographyStyles();
  
  return (
    <DefaultText 
      {...otherProps} 
      style={[typographyStyles[type], style]} 
    />
  );
}