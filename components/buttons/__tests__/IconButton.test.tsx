// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors, Size } from '@/constants/theme';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import React from 'react';
import type { ReactTestRendererJSON } from 'react-test-renderer';
import { Image, Platform, StyleSheet } from 'react-native';
import type { IconButtonSize, IconButtonVariant } from '../IconButton';
import { IconButton, __ICON_BUTTON_TESTING__ } from '../IconButton';
import { ThemedText } from '../../text/ThemedText';

const mockPush = jest.fn();
const defaultResolveHref = (href: string | { pathname?: string }) =>
  typeof href === 'string' ? href : (href.pathname ?? '/');
const mockResolveHref = jest.fn(defaultResolveHref);
const mockLink: {
  resolveHref?: (href: string | { pathname?: string }) => string;
} = {
  resolveHref: (href) => mockResolveHref(href),
};
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
  Platform,
  'OS',
);
const originalPlatformOS = Platform.OS;
const globalScope = global as typeof globalThis & {
  addEventListener?: (type: string, listener: EventListener) => void;
  removeEventListener?: (type: string, listener: EventListener) => void;
  window?: {
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
  };
};
const originalWindow = globalScope.window;
const originalGlobalAddEventListener = globalScope.addEventListener;
const originalGlobalRemoveEventListener = globalScope.removeEventListener;
const originalWindowAddEventListener = globalScope.window?.addEventListener;
const originalWindowRemoveEventListener =
  globalScope.window?.removeEventListener;

const setPlatformOS = (os: string) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
};

const restorePlatformOS = () => {
  if (originalPlatformDescriptor) {
    Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    return;
  }

  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatformOS,
  });
};

const installWindowEventListenerMocks = () => {
  const nextWindow = globalScope.window ?? {};

  globalScope.addEventListener = jest.fn();
  globalScope.removeEventListener = jest.fn();
  nextWindow.addEventListener = jest.fn();
  nextWindow.removeEventListener = jest.fn();
  globalScope.window = nextWindow;
};

const restoreWindowEventListenerMocks = () => {
  if (!globalScope.window) {
    return;
  }

  if (originalGlobalAddEventListener) {
    globalScope.addEventListener = originalGlobalAddEventListener;
  } else {
    Reflect.deleteProperty(globalScope, 'addEventListener');
  }

  if (originalGlobalRemoveEventListener) {
    globalScope.removeEventListener = originalGlobalRemoveEventListener;
  } else {
    Reflect.deleteProperty(globalScope, 'removeEventListener');
  }

  if (originalWindowAddEventListener) {
    globalScope.window.addEventListener = originalWindowAddEventListener;
  } else {
    Reflect.deleteProperty(globalScope.window, 'addEventListener');
  }

  if (originalWindowRemoveEventListener) {
    globalScope.window.removeEventListener = originalWindowRemoveEventListener;
  } else {
    Reflect.deleteProperty(globalScope.window, 'removeEventListener');
  }

  if (originalWindow === undefined) {
    Reflect.deleteProperty(globalScope, 'window');
  } else {
    globalScope.window = originalWindow;
  }
};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => '/',
  Link: mockLink,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    breakpoint: 'desktop',
    contentWidth: 720,
    textWidth: 720,
    gap: 16,
    marginHorizontal: 24,
    rootFontSize: 16,
    scale: 1,
  }),
}));

// Mock icon component for testing
const MockIcon = () => <ThemedText>Icon</ThemedText>;
const mockImpactAsync = Haptics.impactAsync as jest.MockedFunction<
  typeof Haptics.impactAsync
>;

const createIconProbe = () => {
  const calls: { color?: string; size?: string }[] = [];
  const IconProbe = (props: { color?: string; size?: string }) => {
    calls.push(props);
    return <ThemedText testID='icon-button-probe' />;
  };
  return { IconProbe, calls };
};

describe('IconButton Component', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockResolveHref.mockReset();
    mockResolveHref.mockImplementation(defaultResolveHref);
    mockLink.resolveHref = (href) => mockResolveHref(href);
    mockImpactAsync.mockClear();
    restorePlatformOS();
    installWindowEventListenerMocks();
  });

  afterEach(() => {
    restorePlatformOS();
    restoreWindowEventListenerMocks();
  });

  describe('Rendering', () => {
    it('renders with icon prop', () => {
      render(<IconButton icon={<MockIcon />} accessibilityLabel='Close' />);
      expect(screen.getByText('Icon')).toBeDefined();
    });

    it('requires accessibilityLabel for screen readers', () => {
      const { getByLabelText } = render(
        <IconButton icon={<MockIcon />} accessibilityLabel='Settings' />,
      );
      expect(getByLabelText('Settings')).toBeDefined();
    });
  });

  describe('Variants', () => {
    const variants: IconButtonVariant[] = ['primary', 'neutral', 'subtle'];

    variants.forEach((variant) => {
      it(`renders ${variant} variant`, () => {
        render(
          <IconButton
            variant={variant}
            icon={<MockIcon />}
            accessibilityLabel={variant}
          />,
        );
        expect(screen.getByText('Icon')).toBeDefined();
      });
    });

    it('defaults to primary variant when no variant specified', () => {
      const { getByRole } = render(
        <IconButton icon={<MockIcon />} accessibilityLabel='Default' />,
      );
      const button = getByRole('button');
      expect(button).toBeDefined();
      expect(button.props.accessibilityRole).toBe('button');
    });
  });

  describe('Sizes', () => {
    const sizes: IconButtonSize[] = ['small', 'medium'];

    sizes.forEach((size) => {
      it(`renders ${size} size`, () => {
        render(
          <IconButton
            size={size}
            icon={<MockIcon />}
            accessibilityLabel={size}
          />,
        );
        expect(screen.getByText('Icon')).toBeDefined();
      });
    });

    it('defaults to medium size tokens for dimension and radius', () => {
      const { getByLabelText } = render(
        <IconButton icon={<MockIcon />} accessibilityLabel='Default Size' />,
      );
      const button = getByLabelText('Default Size');
      const flattenedStyle = StyleSheet.flatten(button.props.style);
      expect(flattenedStyle.width).toBe(Size.control.dimension.large);
      expect(flattenedStyle.height).toBe(Size.control.dimension.large);
      expect(flattenedStyle.borderRadius).toBe(Size.radius['full']);
    });
  });

  describe('Icons', () => {
    const iconSource = require('../../../assets/images/placeholder.png');

    it('renders asset icon node inside the button', () => {
      render(
        <IconButton
          icon={<Image source={iconSource} testID='icon-button-asset' />}
          accessibilityLabel='Asset Icon'
        />,
      );

      expect(screen.getByTestId('icon-button-asset')).toBeDefined();
      expect(screen.getByRole('button')).toBeDefined();
    });

    it('keeps asset icon visible even when disabled', () => {
      render(
        <IconButton
          disabled
          icon={<Image source={iconSource} testID='icon-button-disabled' />}
          accessibilityLabel='Disabled Asset Icon'
        />,
      );

      expect(screen.getByTestId('icon-button-disabled')).toBeDefined();
    });

    it('injects semantic icon color and medium icon size when missing', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <IconButton icon={<IconProbe />} accessibilityLabel='Semantic Icon' />,
      );

      expect(calls.at(-1)).toEqual(
        expect.objectContaining({
          color: Colors.dark.icon.brand.onBrand,
          size: '20',
        }),
      );
    });

    it('respects custom icon color and size overrides', () => {
      const { IconProbe, calls } = createIconProbe();

      render(
        <IconButton
          icon={<IconProbe color='#123456' size='40' />}
          accessibilityLabel='Custom Icon Props'
        />,
      );

      expect(calls.at(-1)).toEqual(
        expect.objectContaining({
          color: '#123456',
          size: '40',
        }),
      );
    });
  });

  describe('Interaction', () => {
    it('calls onPress when pressed', () => {
      const onPress = jest.fn();
      render(
        <IconButton
          icon={<MockIcon />}
          onPress={onPress}
          accessibilityLabel='Press Me'
        />,
      );

      fireEvent.press(screen.getByLabelText('Press Me'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('triggers a light impact haptic once when enableHaptics is true', () => {
      render(
        <IconButton
          icon={<MockIcon />}
          enableHaptics
          accessibilityLabel='Haptic Button'
        />,
      );

      fireEvent.press(screen.getByLabelText('Haptic Button'));

      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Light,
      );
    });

    it('does not trigger impact haptics when enableHaptics is false', () => {
      render(
        <IconButton icon={<MockIcon />} accessibilityLabel='Silent Button' />,
      );

      fireEvent.press(screen.getByLabelText('Silent Button'));

      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('does not call onPress when disabled', () => {
      const onPress = jest.fn();
      render(
        <IconButton
          disabled
          icon={<MockIcon />}
          onPress={onPress}
          accessibilityLabel='Disabled'
        />,
      );

      fireEvent.press(screen.getByLabelText('Disabled'));
      expect(onPress).not.toHaveBeenCalled();
      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('does not call onLongPress when disabled', () => {
      const onLongPress = jest.fn();

      render(
        <IconButton
          disabled
          icon={<MockIcon />}
          onLongPress={onLongPress}
          accessibilityLabel='Disabled Hold'
        />,
      );

      fireEvent(screen.getByLabelText('Disabled Hold'), 'onLongPress');
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('calls long press only after configured delay and fires press out on release', () => {
      jest.useFakeTimers();
      const delayLongPress = 250;

      const onLongPress = jest.fn();
      const onPressOut = jest.fn();

      try {
        render(
          <IconButton
            icon={<MockIcon />}
            accessibilityLabel='Hold Me'
            onLongPress={onLongPress}
            onPressOut={onPressOut}
            delayLongPress={delayLongPress}
          />,
        );

        const button = screen.getByLabelText('Hold Me');

        setTimeout(() => {
          fireEvent(button, 'onLongPress');
        }, delayLongPress);

        act(() => {
          jest.advanceTimersByTime(delayLongPress - 1);
        });
        expect(onLongPress).not.toHaveBeenCalled();

        act(() => {
          jest.advanceTimersByTime(1);
        });
        expect(onLongPress).toHaveBeenCalledTimes(1);

        fireEvent(button, 'onPressOut');
        expect(onPressOut).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('States', () => {
    it('is disabled when disabled prop is true', () => {
      const onPress = jest.fn();
      render(
        <IconButton
          disabled
          icon={<MockIcon />}
          onPress={onPress}
          accessibilityLabel='Disabled Button'
        />,
      );

      fireEvent.press(screen.getByLabelText('Disabled Button'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('requires accessibilityLabel', () => {
      const { getByLabelText } = render(
        <IconButton icon={<MockIcon />} accessibilityLabel='Menu' />,
      );
      expect(getByLabelText('Menu')).toBeDefined();
    });

    it('sets accessibilityRole to button', () => {
      const { getByRole } = render(
        <IconButton icon={<MockIcon />} accessibilityLabel='Icon Button' />,
      );
      expect(getByRole('button')).toBeDefined();
    });

    it('indicates disabled state in accessibility', () => {
      const { getByRole } = render(
        <IconButton
          disabled
          icon={<MockIcon />}
          accessibilityLabel='Disabled'
        />,
      );
      const button = getByRole('button');
      expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('renders a real href on web when href is provided', () => {
      setPlatformOS('web');

      render(
        <IconButton
          icon={<MockIcon />}
          href='https://example.com/profile'
          accessibilityLabel='Profile'
        />,
      );

      expect(screen.getByLabelText('Profile').props.href).toBe(
        'https://example.com/profile',
      );
      expect(screen.getByLabelText('Profile').props.accessibilityRole).toBe(
        'link',
      );
    });

    it('falls back to hrefPath on web when router href resolution is unavailable', () => {
      setPlatformOS('web');
      mockLink.resolveHref = undefined;

      render(
        <IconButton
          icon={<MockIcon />}
          href={{ pathname: '/about' }}
          hrefPath='/profile'
          accessibilityLabel='Profile Fallback'
        />,
      );

      expect(screen.getByLabelText('Profile Fallback').props.href).toBe(
        '/profile',
      );
    });
  });

  describe('Non-interactive', () => {
    it('renders a non-interactive visual-only container', () => {
      const { toJSON } = render(
        <IconButton
          interactive={false}
          variant='subtle'
          hovered
          icon={<MockIcon />}
        />,
      );

      const tree = toJSON() as ReactTestRendererJSON | null;

      expect(tree).toBeTruthy();
      if (!tree) {
        throw new Error('Expected rendered tree to be non-null');
      }
      expect(tree.props.accessibilityElementsHidden).toBe(true);
      expect(tree.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(StyleSheet.flatten(tree.props.style).pointerEvents).toBe('none');
      expect(tree.props.accessibilityElementsHidden).toBe(true);
      expect(tree.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(StyleSheet.flatten(tree.props.style).pointerEvents).toBe('none');
    });
  });

  describe('Styling', () => {
    it('applies custom style prop', () => {
      const customStyle = { marginTop: 20 };
      const { getByLabelText } = render(
        <IconButton
          icon={<MockIcon />}
          style={customStyle}
          accessibilityLabel='Styled'
        />,
      );
      const button = getByLabelText('Styled');
      expect(button.props.style).toMatchObject(
        expect.arrayContaining([expect.objectContaining(customStyle)]),
      );
    });

    it('uses large control dimension for medium size', () => {
      const { getByLabelText } = render(
        <IconButton
          size='medium'
          icon={<MockIcon />}
          accessibilityLabel='Square'
        />,
      );
      const button = getByLabelText('Square');
      const flattenedStyle = StyleSheet.flatten(button.props.style);
      expect(flattenedStyle.width).toBe(Size.control.dimension.large);
      expect(flattenedStyle.height).toBe(Size.control.dimension.large);
      expect(flattenedStyle.borderRadius).toBe(Size.radius['full']);
    });

    it('uses medium control dimension for small size', () => {
      const { getByLabelText } = render(
        <IconButton
          size='small'
          icon={<MockIcon />}
          accessibilityLabel='Square'
        />,
      );
      const button = getByLabelText('Square');
      const flattenedStyle = StyleSheet.flatten(button.props.style);
      expect(flattenedStyle.width).toBe(Size.control.dimension.medium);
      expect(flattenedStyle.height).toBe(Size.control.dimension.medium);
      expect(flattenedStyle.borderRadius).toBe(Size.radius['full']);
    });

    it('applies pressed brand background token for primary variant', () => {
      const computed = __ICON_BUTTON_TESTING__.computeVariantStyles(
        'primary',
        'dark',
        true,
        false,
        false,
      );
      expect(computed.backgroundColor).toBe(
        Colors.dark.background.brand.pressed,
      );
    });

    it('uses neutral hover token for neutral variant', () => {
      const computed = __ICON_BUTTON_TESTING__.computeVariantStyles(
        'neutral',
        'dark',
        false,
        true,
        false,
      );
      expect(computed.backgroundColor).toBe(
        Colors.dark.background.neutral.secondaryHover,
      );
      expect(computed.iconColor).toBe(
        Colors.dark.icon.neutral.onNeutralSecondary,
      );
    });

    it('keeps subtle variant transparent idle but swaps tokens on hover', () => {
      const idle = __ICON_BUTTON_TESTING__.computeVariantStyles(
        'subtle',
        'dark',
        false,
        false,
        false,
      );
      const hover = __ICON_BUTTON_TESTING__.computeVariantStyles(
        'subtle',
        'dark',
        false,
        true,
        false,
      );
      expect(idle.backgroundColor).toBe('transparent');
      expect(hover.backgroundColor).toBe(
        Colors.dark.background.neutral.tertiaryHover,
      );
      expect(hover.iconColor).toBe(Colors.dark.icon.neutral.onNeutralTertiary);
    });

    it('falls back to disabled palette regardless of variant', () => {
      const lightDisabled = __ICON_BUTTON_TESTING__.computeVariantStyles(
        'primary',
        'light',
        false,
        false,
        true,
      );
      expect(lightDisabled.backgroundColor).toBe(
        Colors.light.background.disabled.default,
      );
      expect(lightDisabled.iconColor).toBe(
        Colors.light.icon.disabled.onDisabled,
      );

      const darkDisabled = __ICON_BUTTON_TESTING__.computeVariantStyles(
        'neutral',
        'dark',
        true,
        true,
        true,
      );
      expect(darkDisabled.backgroundColor).toBe(
        Colors.dark.background.disabled.default,
      );
      expect(darkDisabled.iconColor).toBe(Colors.dark.icon.disabled.onDisabled);
    });
  });

  describe('Internal helper functions', () => {
    it('falls back to default palette for unknown variants', () => {
      const computed = __ICON_BUTTON_TESTING__.computeVariantStyles(
        'unknown' as IconButtonVariant,
        'dark',
        false,
        false,
        false,
      );

      expect(computed.backgroundColor).toBe(
        Colors.dark.background.default.default,
      );
      expect(computed.iconColor).toBe(Colors.dark.icon.default.default);
    });

    it('returns raw node when icon is not a React element', () => {
      expect(__ICON_BUTTON_TESTING__.renderIcon('glyph', '#123456')).toBe(
        'glyph',
      );
    });

    it('does not clone icons that already set color and size', () => {
      const Icon = (props: { color?: string; size?: string }) => (
        <ThemedText accessibilityLabel='icon' style={{ color: props.color }}>
          Icon
        </ThemedText>
      );
      const icon = <Icon color='#abcdef' size='40' />;

      expect(__ICON_BUTTON_TESTING__.renderIcon(icon, '#000000', '20')).toBe(
        icon,
      );
    });
  });
});
