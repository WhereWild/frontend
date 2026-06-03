// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { RoutePressable } from '../RoutePressable';

const mockPush = jest.fn();
const defaultResolveHref = (href: string | { pathname?: string }) =>
  typeof href === 'string' ? href : (href.pathname ?? '/');
const mockResolveHref = jest.fn(defaultResolveHref);
const mockLink: {
  resolveHref?: (href: string | { pathname?: string }) => string;
} = {
  resolveHref: (href) => mockResolveHref(href),
};
let mockPathname = '/';
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
  usePathname: () => mockPathname,
  Link: mockLink,
}));

describe('RoutePressable', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/';
    mockResolveHref.mockReset();
    mockResolveHref.mockImplementation(defaultResolveHref);
    mockLink.resolveHref = (href) => mockResolveHref(href);
    restorePlatformOS();
    installWindowEventListenerMocks();
  });

  afterEach(() => {
    restorePlatformOS();
    restoreWindowEventListenerMocks();
  });

  it('does not navigate when the target string href matches the current pathname', () => {
    mockPathname = '/about';

    render(
      <RoutePressable href='/about' testID='route-pressable'>
        <ThemedText>About</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates when the target string href differs from the current pathname', () => {
    mockPathname = '/';

    render(
      <RoutePressable href='/about' testID='route-pressable'>
        <ThemedText>About</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(mockPush).toHaveBeenCalledWith('/about');
  });

  it('does not navigate when an object href matches the current pathname via hrefPath', () => {
    mockPathname = '/species/555/binomial-nomenclature';

    render(
      <RoutePressable
        href={{
          pathname: '/species/[...identifier]',
          params: { identifier: ['555', 'binomial-nomenclature'] },
        }}
        hrefPath='/species/555/binomial-nomenclature'
        testID='route-pressable'
      >
        <ThemedText>Species</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('adds a real href on web so the browser can expose native link affordances', () => {
    setPlatformOS('web');

    render(<RoutePressable href='/about' testID='route-pressable' />);

    expect(screen.getByTestId('route-pressable').props.href).toBe('/about');
  });

  it('prefers hrefPath over Link.resolveHref for object hrefs on web', () => {
    setPlatformOS('web');
    mockResolveHref.mockReturnValue('/species/[...identifier]');

    render(
      <RoutePressable
        href={{
          pathname: '/species/[...identifier]',
          params: { identifier: ['555', 'binomial-nomenclature'] },
        }}
        hrefPath='/species/555/binomial-nomenclature'
        testID='route-pressable'
      />,
    );

    expect(screen.getByTestId('route-pressable').props.href).toBe(
      '/species/555/binomial-nomenclature',
    );
  });

  it('falls back to hrefPath on web when Link.resolveHref is unavailable', () => {
    setPlatformOS('web');
    mockLink.resolveHref = undefined;

    render(
      <RoutePressable
        href={{
          pathname: '/species/[...identifier]',
          params: { identifier: ['555', 'binomial-nomenclature'] },
        }}
        hrefPath='/species/555/binomial-nomenclature'
        testID='route-pressable'
      />,
    );

    expect(screen.getByTestId('route-pressable').props.href).toBe(
      '/species/555/binomial-nomenclature',
    );
  });

  it('lets modifier-click fall back to the browser on web without calling onPress or router.push', () => {
    setPlatformOS('web');
    const handlePress = jest.fn();

    render(
      <RoutePressable
        href='/about'
        hrefPath='/about'
        onPress={handlePress}
        testID='route-pressable'
      />,
    );

    fireEvent(screen.getByTestId('route-pressable'), 'press', {
      nativeEvent: { ctrlKey: true },
    });

    expect(handlePress).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not intercept middle-click on web', () => {
    setPlatformOS('web');

    render(
      <RoutePressable
        href='/about'
        hrefPath='/about'
        testID='route-pressable'
      />,
    );

    fireEvent(screen.getByTestId('route-pressable'), 'press', {
      nativeEvent: { button: 1 },
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('lets the browser handle targeted links on web', () => {
    setPlatformOS('web');
    const handlePress = jest.fn();

    render(
      <RoutePressable
        href='/about'
        hrefPath='/about'
        hrefAttrs={{ target: '_blank' }}
        onPress={handlePress}
        testID='route-pressable'
      />,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(handlePress).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('lets the browser handle same-tab download links on web', () => {
    setPlatformOS('web');
    const handlePress = jest.fn();

    render(
      <RoutePressable
        href='https://example.com/files/export.csv'
        hrefPath='https://example.com/files/export.csv'
        hrefAttrs={{ download: true }}
        onPress={handlePress}
        testID='route-pressable'
      />,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(handlePress).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates normally when web event target is not an anchor element', () => {
    setPlatformOS('web');
    const handlePress = jest.fn();

    render(
      <RoutePressable
        href='/about'
        hrefPath='/about'
        onPress={handlePress}
        navigateAfterPress={true}
        testID='route-pressable'
      />,
    );

    fireEvent(screen.getByTestId('route-pressable'), 'press', {
      nativeEvent: { target: 'react-native-web-node-17' },
    });

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/about');
  });

  it('calls onPress without navigating when no href is provided', () => {
    const handlePress = jest.fn();

    render(
      <RoutePressable onPress={handlePress} testID='route-pressable'>
        <ThemedText>Plain Pressable</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('falls back to the raw string href on web when Link.resolveHref is unavailable', () => {
    setPlatformOS('web');
    mockLink.resolveHref = undefined;

    render(<RoutePressable href='/about' testID='route-pressable' />);

    expect(screen.getByTestId('route-pressable').props.href).toBe('/about');
  });

  it('calls onPress and suppresses navigation by default when a handler is provided', () => {
    const handlePress = jest.fn();

    render(
      <RoutePressable
        href='/about'
        onPress={handlePress}
        testID='route-pressable'
      >
        <ThemedText>About</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('calls onPress and still navigates when navigateAfterPress is true', () => {
    const handlePress = jest.fn();

    render(
      <RoutePressable
        href='/about'
        onPress={handlePress}
        navigateAfterPress={true}
        testID='route-pressable'
      >
        <ThemedText>About</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/about');
  });
});
