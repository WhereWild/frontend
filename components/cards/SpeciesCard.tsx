import { IconImage } from '@/assets/icons';
import { Colors, Size, type ColorPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  GestureResponderEvent,
  Pressable,
  PressableStateCallbackType,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { ThemedText } from '../text/ThemedText';
import type { Href } from 'expo-router';
import { toKebabCase } from '@/utils/string';
import { RoutePressable } from '../navigation/RoutePressable';
import { getInteractiveCursorStyle } from '../interactiveCursorStyle';
export type SpeciesCardVariant = 'secondary' | 'tertiary';
export type SpeciesCardSize = 'default' | 'compact';
export type SpeciesCardInteractionMode = 'route' | 'press-only';

export type SpeciesCardProps = {
  taxonId: number;
  commonName: string;
  scientificName: string;
  description?: string;
  imageSource?: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * Optional press callback. In the default `route` mode, same-tab navigation is suppressed when provided,
   * while web modifier-click can still use the species route when route data is valid. Use `press-only`
   * when the card should behave purely like a selectable result without exposing route href semantics.
   */
  onPress?: () => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  onPointerDown?: () => void;
  onPointerUp?: () => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  interactionMode?: SpeciesCardInteractionMode;
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
  description,
  imageSource,
  style,
  testID,
  onPress,
  onPressIn,
  onPressOut,
  onPointerDown,
  onPointerUp,
  onTouchStart,
  onTouchEnd,
  interactionMode = 'route',
  variant = 'secondary',
  size = 'default',
}: SpeciesCardProps) {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const placeholderBackground = palette.background.neutral.default;
  const placeholderIcon = palette.icon.neutral.tertiary;
  const backgroundForState = (state: PressableStateCallbackType) =>
    resolveSpeciesCardBackground(palette, state, variant);
  const trimmedScientificName = scientificName?.trim();
  const scientificSegment = trimmedScientificName
    ? toKebabCase(trimmedScientificName)
    : '';
  const hasValidTaxonId = typeof taxonId === 'number';
  const hasValidScientificName = Boolean(trimmedScientificName);
  const hasValidSegment = Boolean(scientificSegment);
  const isPressOnly = interactionMode === 'press-only';
  const shouldProvideRouteHref = !isPressOnly;
  const href = (
    shouldProvideRouteHref && hasValidTaxonId && hasValidSegment
      ? {
          pathname: '/species/[...identifier]',
          params: { identifier: [taxonId.toString(), scientificSegment] },
        }
      : undefined
  ) as Href | undefined;
  const hrefPath =
    shouldProvideRouteHref && hasValidTaxonId && hasValidSegment
      ? `/species/${taxonId}/${scientificSegment}`
      : undefined;

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }

    if (typeof taxonId !== 'number') {
      console.error('SpeciesCard requires a taxonId to navigate');
      return;
    }

    if (!hasValidScientificName) {
      console.error('SpeciesCard requires a scientific name to navigate');
      return;
    }

    if (!hasValidSegment) {
      console.error(
        'SpeciesCard: scientific name could not be converted to a valid URL segment',
      );
      return;
    }
  };

  const pressableStyle = (state: PressableStateCallbackType) => [
    getInteractiveCursorStyle(),
    styles.container,
    size === 'compact' && styles.containerCompact,
    {
      backgroundColor: backgroundForState(state),
      borderRadius: Size.radius['200'],
    },
    style,
  ];

  const content = (
    <View collapsable={false} style={styles.contentWrapper}>
      <View
        style={[
          styles.imageWrapper,
          size === 'compact' && styles.imageWrapperCompact,
          !imageSource && { backgroundColor: placeholderBackground },
        ]}
      >
        {imageSource ? (
          <Image
            testID='species-card-image'
            source={imageSource}
            style={styles.image}
            resizeMode='cover'
            accessibilityLabel={`${commonName} habitat`}
          />
        ) : (
          <View
            style={[
              styles.placeholder,
              { backgroundColor: placeholderBackground },
            ]}
            testID='species-card-placeholder'
          >
            <IconImage size='24' color={placeholderIcon} />
          </View>
        )}
      </View>

      <View
        style={[
          styles.textSection,
          size === 'compact' && styles.textSectionCompact,
        ]}
      >
        <View>
          <ThemedText
            variant='subheading'
            numberOfLines={1}
            accessibilityRole='header'
          >
            {commonName}
          </ThemedText>
          <ThemedText variant='bodySmallEmphasis' numberOfLines={1}>
            {scientificName}
          </ThemedText>
        </View>

        {size === 'default' && (
          <ThemedText
            variant='body'
            style={styles.description}
            numberOfLines={3}
            testID='species-card-description'
          >
            {description}
          </ThemedText>
        )}
      </View>
    </View>
  );

  if (isPressOnly) {
    return (
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        accessibilityRole='button'
        accessibilityLabel={`${commonName}. ${scientificName}. ${description}`}
        testID={testID}
        style={pressableStyle}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <RoutePressable
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      href={href}
      hrefPath={hrefPath}
      navigateAfterPress={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${commonName}. ${scientificName}. ${description}`}
      testID={testID}
      style={pressableStyle}
    >
      {content}
    </RoutePressable>
  );
}

const styles = StyleSheet.create({
  contentWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Size.space['400'],
    width: '100%',
  },
  container: {
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
  description: {
    marginTop: Size.space['200'],
  },
});

export const __SPECIES_CARD_TESTING__ = {
  resolveSpeciesCardBackground,
};
