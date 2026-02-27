import { IconImage } from '@/assets/icons';
import { Colors, Size, type ColorPalette } from '@/constants/theme';
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
import { useRouter } from 'expo-router';
import { toKebabCase } from '@/utils/string';
export type SpeciesCardVariant = 'secondary' | 'tertiary';
export type SpeciesCardSize = 'default' | 'compact';

export type SpeciesCardProps = {
  taxonId: number;
  commonName: string;
  scientificName: string;
  description?: string;
  imageSource?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  onPress?: () => void;
  variant?: SpeciesCardVariant;
  size?: SpeciesCardSize;
};

const DEFAULT_IMAGE_SIZE = 128;
const COMPACT_IMAGE_SIZE = 56;
const MAX_WIDTH = 465;

/**
 * Keeps 'secondary' as the default to preserve the palette used before variants existed.
 */
const resolveSpeciesCardBackground = (
  palette: ColorPalette,
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
  taxonId,
  commonName,
  scientificName,
  imageSource,
  style,
  testID,
  onPress,
  variant = 'secondary',
  size = 'default',
}: SpeciesCardProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const router = useRouter();

  const placeholderBackground = palette.background.neutral.default;
  const placeholderIcon = palette.icon.neutral.tertiary;
  const backgroundForState = (state: PressableStateCallbackType) =>
    resolveSpeciesCardBackground(palette, state, variant);
  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (typeof taxonId !== 'number') {
      console.error('SpeciesCard requires a taxonId to navigate');
      return;
    }

    const trimmedScientificName = scientificName?.trim();
    if (!trimmedScientificName) {
      console.error('SpeciesCard requires a scientific name to navigate');
      return;
    }

    const scientificSegment = toKebabCase(trimmedScientificName);
    if (!scientificSegment) {
      console.error('SpeciesCard: scientific name could not be converted to a valid URL segment');
      return;
    }

    router.push({
      pathname: '/species/[...identifier]',
      params: { identifier: [taxonId.toString(), scientificSegment] },
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${commonName}. ${scientificName}.`}
      testID={testID}
      style={(state) => [
        styles.container,
        size === 'compact' && styles.containerCompact,
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
          size === 'compact' && styles.imageWrapperCompact,
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

      <View style={[
        styles.textSection,
        size === 'compact' && styles.textSectionCompact,
      ]}>
        <View>
          <ThemedText variant="subheading" numberOfLines={1} accessibilityRole="header">
            {commonName}
          </ThemedText>
          <ThemedText variant="bodySmallEmphasis" numberOfLines={1}>
            {scientificName}
          </ThemedText>
        </View>
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
  containerCompact: {
    alignItems: 'center',
    padding: Size.space['200'],
    gap: Size.space['200'],
    maxWidth: MAX_WIDTH,
  },
  imageWrapper: {
    width: DEFAULT_IMAGE_SIZE,
    height: DEFAULT_IMAGE_SIZE,
    borderRadius: Size.radius['200'],
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapperCompact: {
    width: COMPACT_IMAGE_SIZE,
    height: COMPACT_IMAGE_SIZE,
    flexShrink: 0,
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
    minHeight: DEFAULT_IMAGE_SIZE,
    justifyContent: 'space-between',
  },
  textSectionCompact: {
    minHeight: COMPACT_IMAGE_SIZE,
    justifyContent: 'center',
    gap: Size.space['100'],
  },
});

export const __SPECIES_CARD_TESTING__ = {
  resolveSpeciesCardBackground,
};
