import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemedText } from '@/components/text/ThemedText';
import { RoutePressable } from '../RoutePressable';

const mockPush = jest.fn();
let mockPathname = '/';
const originalWindowOpen = window.open;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => mockPathname,
}));

describe('RoutePressable', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockPathname = '/';
    window.open = originalWindowOpen;
  });

  afterEach(() => {
    window.open = originalWindowOpen;
  });

  it('does not navigate when the target string href matches the current pathname', () => {
    mockPathname = '/components';

    render(
      <RoutePressable href="/components" testID="route-pressable">
        <ThemedText>Components</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates when the target string href differs from the current pathname', () => {
    mockPathname = '/';

    render(
      <RoutePressable href="/components" testID="route-pressable">
        <ThemedText>Components</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(mockPush).toHaveBeenCalledWith('/components');
  });

  it('does not navigate when an object href matches the current pathname via hrefPath', () => {
    mockPathname = '/species/555/binomial-nomenclature';

    render(
      <RoutePressable
        href={{
          pathname: '/species/[...identifier]',
          params: { identifier: ['555', 'binomial-nomenclature'] },
        }}
        hrefPath="/species/555/binomial-nomenclature"
        testID="route-pressable"
      >
        <ThemedText>Species</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens hrefPath in a new tab on ctrl-click without calling onPress or router.push', () => {
    const handlePress = jest.fn();
    const openMock = jest.fn(() => null);
    window.open = openMock;

    render(
      <RoutePressable
        href="/components"
        hrefPath="/components"
        onPress={handlePress}
        testID="route-pressable"
      >
        <ThemedText>Components</ThemedText>
      </RoutePressable>,
    );

    fireEvent(screen.getByTestId('route-pressable'), 'press', { nativeEvent: { ctrlKey: true } });

    expect(openMock).toHaveBeenCalledWith('/components', '_blank', 'noopener,noreferrer');
    expect(handlePress).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens hrefPath in a new window on shift-click without using router.push', () => {
    const openedWindow = { opener: {} } as Window;
    const openMock = jest.fn(() => openedWindow);
    window.open = openMock;

    render(
      <RoutePressable href="/components" hrefPath="/components" testID="route-pressable">
        <ThemedText>Components</ThemedText>
      </RoutePressable>,
    );

    fireEvent(screen.getByTestId('route-pressable'), 'press', { nativeEvent: { shiftKey: true } });

    expect(openMock).toHaveBeenCalledWith('/components', '_blank');
    expect(openedWindow.opener).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('calls onPress and suppresses navigation by default when a handler is provided', () => {
    const handlePress = jest.fn();

    render(
      <RoutePressable href="/components" onPress={handlePress} testID="route-pressable">
        <ThemedText>Components</ThemedText>
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
        href="/components"
        onPress={handlePress}
        navigateAfterPress={true}
        testID="route-pressable"
      >
        <ThemedText>Components</ThemedText>
      </RoutePressable>,
    );

    fireEvent.press(screen.getByTestId('route-pressable'));

    expect(handlePress).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/components');
  });
});