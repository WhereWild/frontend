import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  PressableStateCallbackType,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { IconImage } from '@/assets/icons';
import { Colors, Size, Typography } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

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

  const containerBackground = palette.background.default.secondary;
  const placeholderBackground = palette.background.neutral.default;
  const placeholderIcon = palette.icon.neutral.tertiary;
  const backgroundForState = ({ hovered, pressed }: PressableStateCallbackType) => {
    if (pressed) {
      return palette.background.default.secondaryPressed;
    }
    if (hovered) {
      return palette.background.default.secondaryHover;
    }
    return containerBackground;
  };

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
          <Text
            style={Typography[mode].subheading}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {commonName}
          </Text>
          <Text
            style={[
              Typography[mode].bodySmallEmphasis,
              { color: palette.text.default.default },
            ]}
            numberOfLines={1}
          >
            {scientificName}
          </Text>
        </View>

        <Text
          style={[
            Typography[mode].body,
            styles.description,
            { color: palette.text.default.default },
          ]}
          numberOfLines={3}
        >
          {description}
        </Text>
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
