// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  Time,
  TimeEasingCurves,
  getReactNativeEasing,
} from '@/constants/theme';
import type { ComponentType } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';
import { useTypographyStyles } from '@/hooks/useTypographyStyles';

type TypographyVariants = keyof ReturnType<typeof useTypographyStyles>;

type HoverHandlers = {
  onHoverIn?: (event: unknown) => void;
  onHoverOut?: (event: unknown) => void;
};

type ThemedTextProps = TextProps &
  HoverHandlers & {
    variant?: TypographyVariants;
  };

type HoverInEvent = Parameters<NonNullable<HoverHandlers['onHoverIn']>>[0];
type HoverOutEvent = Parameters<NonNullable<HoverHandlers['onHoverOut']>>[0];
type PressInEvent = Parameters<NonNullable<ThemedTextProps['onPressIn']>>[0];
type PressOutEvent = Parameters<NonNullable<ThemedTextProps['onPressOut']>>[0];

type WebMouseHandlers = {
  onMouseEnter?: (event: HoverInEvent) => void;
  onMouseLeave?: (event: HoverOutEvent) => void;
};

type AnimatedTextProps = Omit<TextProps, 'style'> &
  WebMouseHandlers & {
    style?: StyleProp<TextStyle>;
  };

const AnimatedText = Animated.Text as ComponentType<AnimatedTextProps>;

export function ThemedText({
  style,
  variant = 'body',
  onHoverIn,
  onHoverOut,
  onPressIn,
  onPressOut,
  ...otherProps
}: ThemedTextProps) {
  const typographyStyles = useTypographyStyles();
  const resolvedVariant = typographyStyles[variant] ? variant : 'body';
  const isLinkVariant =
    resolvedVariant === 'link' || resolvedVariant === 'bodySmallLink';
  const isWebLinkVariant = Platform.OS === 'web' && isLinkVariant;
  const [isWebHovered, setIsWebHovered] = useState(false);
  const underlineProgress = useRef(new Animated.Value(0)).current;
  const variantColor =
    typographyStyles[resolvedVariant]?.color ?? typographyStyles.link.color;

  const animatedUnderlineStyle = useMemo(() => {
    if (!isLinkVariant || isWebLinkVariant) {
      return undefined;
    }

    return {
      textDecorationColor: underlineProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ['transparent', variantColor],
      }),
    } as unknown as TextStyle;
  }, [isLinkVariant, isWebLinkVariant, underlineProgress, variantColor]);

  const webHoverTransitionStyle = useMemo(() => {
    if (!isWebLinkVariant) {
      return undefined;
    }

    return {
      textDecorationColor: isWebHovered ? variantColor : 'transparent',
      transitionProperty: 'text-decoration-color',
      transitionDuration: `${Time.duration.short}ms`,
      transitionTimingFunction: `cubic-bezier(${TimeEasingCurves['in-and-out'].join(', ')})`,
    } as TextStyle & {
      transitionProperty: string;
      transitionDuration: string;
      transitionTimingFunction: string;
    };
  }, [isWebHovered, isWebLinkVariant, variantColor]);

  if (__DEV__ && variant !== resolvedVariant) {
    console.warn(
      `ThemedText: unknown variant "${String(variant)}". Falling back to "body".`,
    );
  }

  const animateUnderlineTo = useCallback(
    (toValue: number) => {
      Animated.timing(underlineProgress, {
        toValue,
        duration: Time.duration.short,
        easing: getReactNativeEasing('in-and-out'),
        useNativeDriver: false,
      }).start();
    },
    [underlineProgress],
  );

  const interactionHandlers = useMemo<AnimatedTextProps | undefined>(() => {
    if (!isLinkVariant) {
      return undefined;
    }

    if (isWebLinkVariant) {
      return {
        onMouseEnter: (event: HoverInEvent) => {
          setIsWebHovered(true);
          onHoverIn?.(event);
        },
        onMouseLeave: (event: HoverOutEvent) => {
          setIsWebHovered(false);
          onHoverOut?.(event);
        },
        onPressIn: (event: PressInEvent) => {
          setIsWebHovered(true);
          onPressIn?.(event);
        },
        onPressOut: (event: PressOutEvent) => {
          setIsWebHovered(false);
          onPressOut?.(event);
        },
      };
    }

    return {
      onHoverIn: (event: HoverInEvent) => {
        animateUnderlineTo(1);
        onHoverIn?.(event);
      },
      onHoverOut: (event: HoverOutEvent) => {
        animateUnderlineTo(0);
        onHoverOut?.(event);
      },
      onPressIn: (event: PressInEvent) => {
        animateUnderlineTo(1);
        onPressIn?.(event);
      },
      onPressOut: (event: PressOutEvent) => {
        animateUnderlineTo(0);
        onPressOut?.(event);
      },
    };
  }, [
    animateUnderlineTo,
    isLinkVariant,
    isWebLinkVariant,
    onHoverIn,
    onHoverOut,
    onPressIn,
    onPressOut,
  ]);

  return (
    <AnimatedText
      {...otherProps}
      {...interactionHandlers}
      style={[
        typographyStyles[resolvedVariant],
        animatedUnderlineStyle,
        webHoverTransitionStyle,
        style,
      ]}
    />
  );
}
