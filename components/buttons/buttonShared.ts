import React from 'react';
import { Size } from '@/constants/theme';
import { IconSize } from '../../primitives/Icon';

export type ButtonIconElement = React.ReactElement<{ color?: string; size?: IconSize }>;
export type ButtonIcon = React.ComponentType<{ color?: string; size?: IconSize }> | ButtonIconElement;

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

export const renderButtonIcon = (icon: ButtonIcon | undefined, color: string, size: IconSize) => {
  if (!icon) {
    return null;
  }

  if (React.isValidElement(icon)) {
    const currentProps = icon.props as { color?: string; size?: IconSize };
    return React.cloneElement(icon, {
      color: currentProps.color ?? color,
      size: currentProps.size ?? size,
    });
  }

  return React.createElement(icon, { color, size });
};