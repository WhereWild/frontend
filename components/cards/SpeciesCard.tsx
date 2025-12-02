import { IconImage } from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  PressableStateCallbackType,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { ThemedText } from '../text/ThemedText';

export type SpeciesCardVariant = 'secondary' | 'tertiary';

export type SpeciesCardProps = {
  commonName: string;
  scientificName: string;
  description: string;
  imageSource?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  onPress?: () => void;
  variant?: SpeciesCardVariant;
};

const IMAGE_SIZE = 128;
const MAX_WIDTH = 440;

/**
 * Keeps 'secondary' as the default to preserve the palette used before variants existed.
 */
const resolveSpeciesCardBackground = (
  palette: typeof Colors.light,
  state: PressableStateCallbackType,
  variant: SpeciesCardVariant = 'secondary',
) => {
  const colors =
    variant === 'tertiary'
      ? {
          default: palette.background.default.tertiary,
          hover: palette.background.default.tertiaryHover,
          pressed: palette.background.default.tertiaryPressed,
        }
      : {
          default: palette.background.default.secondary,
          hover: palette.background.default.secondaryHover,
          pressed: palette.background.default.secondaryPressed,
        };

  if (state.pressed) {
    return colors.pressed;
  }
  if (state.hovered) {
    return colors.hover;
  }
  return colors.default;
};

export function SpeciesCard({
  commonName,
  scientificName,
  description,
  imageSource,
  style,
  testID,
  onPress,
  variant = 'secondary',
}: SpeciesCardProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const placeholderBackground = palette.background.neutral.default;
  const placeholderIcon = palette.icon.neutral.tertiary;
  const backgroundForState = (state: PressableStateCallbackType) =>
    resolveSpeciesCardBackground(palette, state, variant);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${commonName}. ${scientificName}. ${description}`}
      testID={testID}
      style={(state) => [
        styles.container,
        {
          backgroundColor: backgroundForState(state),
          borderRadius: Size.radius['200'],
        },
        style,
      ]}
    >
      <View
        style={[
          styles.imageWrapper,
          !imageSource && { backgroundColor: placeholderBackground },
        ]}
      >
        {imageSource ? (
          <Image
            testID="species-card-image"
            source={imageSource}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel={`${commonName} habitat`}
          />
        ) : (
          <View
            style={[styles.placeholder, { backgroundColor: placeholderBackground }]}
            testID="species-card-placeholder"
          >
            <IconImage size="24" color={placeholderIcon} />
          </View>
        )}
      </View>

      <View style={styles.textSection}>
        <View>
          <ThemedText variant="subheading" numberOfLines={1} accessibilityRole="header">
            {commonName}
          </ThemedText>
          <ThemedText variant="bodySmallEmphasis" numberOfLines={1}>
            {scientificName}
          </ThemedText>
        </View>

        <ThemedText variant="body" style={styles.description} numberOfLines={3}>
          {description}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Size.space['400'],
    gap: Size.space['400'],
    maxWidth: MAX_WIDTH,
    width: '100%',
  },
  imageWrapper: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: Size.radius['200'],
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Size.radius['200'],
  },
  textSection: {
    flex: 1,
    minHeight: IMAGE_SIZE,
    justifyContent: 'space-between',
  },
  description: {
    marginTop: Size.space['200'],
  },
});

export const __SPECIES_CARD_TESTING__ = {
  resolveSpeciesCardBackground,
};
