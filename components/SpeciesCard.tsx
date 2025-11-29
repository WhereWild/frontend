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
import { IconImage } from '@/assets/icons';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemedText } from './ThemedText';

export type SpeciesCardProps = {
  commonName: string;
  scientificName: string;
  description: string;
  imageSource?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  onPress?: () => void;
};

const IMAGE_SIZE = 128;
const MAX_WIDTH = 440;

const resolveSpeciesCardBackground = (
  palette: typeof Colors.light,
  state: PressableStateCallbackType,
) => {
  if (state.pressed) {
    return palette.background.default.secondaryPressed;
  }
  if (state.hovered) {
    return palette.background.default.secondaryHover;
  }
  return palette.background.default.secondary;
};

export function SpeciesCard({
  commonName,
  scientificName,
  description,
  imageSource,
  style,
  testID,
  onPress,
}: SpeciesCardProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const placeholderBackground = palette.background.neutral.default;
  const placeholderIcon = palette.icon.neutral.tertiary;
  const backgroundForState = (state: PressableStateCallbackType) =>
    resolveSpeciesCardBackground(palette, state);

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
