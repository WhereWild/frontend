// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import {
  Platform,
  type GestureResponderEvent,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Size, Time, TimeEasingCurves } from '@/constants/theme';
import type { IconProps, IconSize } from '../../primitives/Icon';

export type ButtonIconElement = React.ReactElement<
  Pick<IconProps, 'color' | 'size' | 'style'>
>;
export type ButtonIcon =
  | React.ComponentType<Pick<IconProps, 'color' | 'size' | 'style'>>
  | ButtonIconElement;

type ButtonTransitionStyle = {
  transitionProperty: string;
  transitionDuration: string;
  transitionTimingFunction: string;
};

type RenderButtonIconOptions = {
  animate?: boolean;
};

type HoverOnlyTransitionOptions = {
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
};

type HoverInEvent = Parameters<NonNullable<PressableProps['onHoverIn']>>[0];
type HoverOutEvent = Parameters<NonNullable<PressableProps['onHoverOut']>>[0];

export const createButtonTransitionStyle = (
  transitionProperty: string,
): ButtonTransitionStyle => ({
  transitionProperty,
  transitionDuration: `${Time.duration.short}ms`,
  transitionTimingFunction: `cubic-bezier(${TimeEasingCurves['in-and-out'].join(', ')})`,
});

const resolveWebTransitionStyle = <T extends ViewStyle | TextStyle>(
  transitionProperty: string,
): T | undefined =>
  Platform.OS === 'web'
    ? (createButtonTransitionStyle(transitionProperty) as T)
    : undefined;

export const buttonSurfaceTransitionStyle =
  resolveWebTransitionStyle<ViewStyle>('background-color, border-color');

export const buttonTextTransitionStyle =
  resolveWebTransitionStyle<TextStyle>('color');

export const buttonIconTransitionStyle = resolveWebTransitionStyle<ViewStyle>(
  'color, fill, stroke',
);

export const getButtonSurfaceTransitionStyle = (animate: boolean) =>
  animate ? buttonSurfaceTransitionStyle : undefined;

export const getButtonTextTransitionStyle = (animate: boolean) =>
  animate ? buttonTextTransitionStyle : undefined;

export const getButtonIconTransitionStyle = (animate: boolean) =>
  animate ? buttonIconTransitionStyle : undefined;

export const useHoverOnlyButtonTransitions = (
  options?: HoverOnlyTransitionOptions,
) => {
  const [shouldAnimateTransitions, setShouldAnimateTransitions] =
    React.useState(false);
  const onPressIn = options?.onPressIn;
  const onPressOut = options?.onPressOut;

  const handleHoverIn = React.useCallback(() => {
    setShouldAnimateTransitions(true);
  }, []);

  const handleHoverOut = React.useCallback(() => {
    setShouldAnimateTransitions(true);
  }, []);

  const handlePressIn = React.useCallback(
    (event: GestureResponderEvent) => {
      setShouldAnimateTransitions(false);
      onPressIn?.(event);
    },
    [onPressIn],
  );

  const handlePressOut = React.useCallback(
    (event: GestureResponderEvent) => {
      setShouldAnimateTransitions(false);
      onPressOut?.(event);
    },
    [onPressOut],
  );

  const hoverOnlyTransitionHandlers = React.useMemo(
    () => ({
      onHoverIn: (_event: HoverInEvent) => {
        handleHoverIn();
      },
      onHoverOut: (_event: HoverOutEvent) => {
        handleHoverOut();
      },
      onPressIn: handlePressIn,
      onPressOut: handlePressOut,
    }),
    [handleHoverIn, handleHoverOut, handlePressIn, handlePressOut],
  );

  return {
    shouldAnimateTransitions,
    hoverOnlyTransitionHandlers,
  };
};

export const resolveButtonAccessibilityLabel = (
  accessibilityLabel: string | undefined,
  label: string | undefined,
  children: React.ReactNode,
): string | undefined => {
  if (accessibilityLabel) {
    return accessibilityLabel;
  }

  if (typeof label === 'string') {
    return label;
  }

  return typeof children === 'string' ? children : undefined;
};

export const computeButtonSizeStyles = (size: 'small' | 'medium') => {
  if (size === 'small') {
    return {
      paddingHorizontal: Size.space['200'],
      paddingVertical: Size.space['150'],
      minHeight: Size.control.height.short,
    };
  }

  return {
    paddingHorizontal: Size.space['300'],
    paddingVertical: Size.space['250'],
    minHeight: Size.control.height.medium,
  };
};

export const renderButtonIconElement = (
  icon: React.ReactNode,
  color: string,
  size?: IconSize,
  options?: RenderButtonIconOptions,
) => {
  if (!React.isValidElement(icon)) {
    return icon;
  }

  const iconElement = icon as ButtonIconElement;
  const currentProps = iconElement.props as Pick<
    IconProps,
    'color' | 'size' | 'style'
  >;
  const iconTransitionStyle = getButtonIconTransitionStyle(
    options?.animate ?? true,
  );
  const mergedStyle =
    iconTransitionStyle == null && currentProps.style == null
      ? undefined
      : [iconTransitionStyle, currentProps.style];
  const nextColor = currentProps.color ?? color;
  const nextSize = currentProps.size ?? size;

  if (
    nextColor === currentProps.color &&
    nextSize === currentProps.size &&
    mergedStyle === currentProps.style
  ) {
    return icon;
  }

  return React.cloneElement(iconElement, {
    color: nextColor,
    size: nextSize,
    style: mergedStyle,
  });
};

export const renderButtonIcon = (
  icon: ButtonIcon | undefined,
  color: string,
  size: IconSize,
  options?: RenderButtonIconOptions,
) => {
  if (!icon) {
    return null;
  }

  if (React.isValidElement(icon)) {
    return renderButtonIconElement(icon, color, size, options);
  }

  const iconProps: Pick<IconProps, 'color' | 'size' | 'style'> = {
    color,
    size,
  };

  const iconTransitionStyle = getButtonIconTransitionStyle(
    options?.animate ?? true,
  );

  if (iconTransitionStyle) {
    iconProps.style = iconTransitionStyle;
  }

  return React.createElement(icon, iconProps);
};
