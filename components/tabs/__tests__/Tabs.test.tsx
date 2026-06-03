// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  Platform,
  StyleSheet,
  type PressableProps,
  type View,
} from 'react-native';
import { Tabs, __TABS_TESTING__ } from '../Tabs';

const toStyleArray = (value: unknown) =>
  Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);

jest.mock('../Tab', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ReactNative =
    jest.requireActual<typeof import('react-native')>('react-native');
  const PressableWithKeyDown =
    ReactNative.Pressable as unknown as React.ForwardRefExoticComponent<
      PressableProps & {
        onKeyDown?: (event: {
          nativeEvent?: { key?: string };
          preventDefault?: () => void;
        }) => void;
        tabIndex?: 0 | -1;
      } & React.RefAttributes<View>
    >;

  const Tab = React.forwardRef(
    (props: any, ref: React.ForwardedRef<{ focus: () => void }>) => {
      const {
        id,
        label,
        isActive,
        onPress,
        onLabelLayout,
        onKeyDown,
        onFocus,
        focusable,
        tabIndex,
        accessibilityLabel,
        testID,
      } = props;

      React.useImperativeHandle(
        ref,
        () => ({
          focus: () => {
            onFocus?.();
          },
        }),
        [onFocus],
      );

      return (
        <PressableWithKeyDown
          accessibilityRole='tab'
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ selected: isActive }}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          focusable={focusable}
          tabIndex={tabIndex}
          onPress={() => {
            if (!isActive) {
              onPress(id);
            }
          }}
          onLayout={(event) => {
            onLabelLayout?.(event.nativeEvent.layout.width);
          }}
          testID={testID}
        >
          {label}
        </PressableWithKeyDown>
      );
    },
  );

  Tab.displayName = 'MockTab';

  return { Tab };
});

const tabs = [
  { key: 'one', label: 'One' },
  { key: 'two', label: 'Two' },
  { key: 'three', label: 'Three' },
  { key: 'four', label: 'Four' },
];

const TabsHarness = ({
  initialKey = 'one',
  onSelectionChange,
  accessibilityLabel = 'Example Tabs',
}: {
  initialKey?: string;
  onSelectionChange?: (key: string) => void;
  accessibilityLabel?: string;
}) => {
  const [selectedKey, setSelectedKey] = useState(initialKey);
  return (
    <Tabs
      tabs={tabs}
      selectedKey={selectedKey}
      accessibilityLabel={accessibilityLabel}
      onSelectionChange={(key) => {
        onSelectionChange?.(key);
        setSelectedKey(key);
      }}
    />
  );
};

describe('Tabs', () => {
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
    Platform,
    'OS',
  );

  const setPlatformOS = (os: 'ios' | 'web') => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      get: () => os,
    });
  };

  afterEach(() => {
    if (originalPlatformDescriptor) {
      Object.defineProperty(Platform, 'OS', originalPlatformDescriptor);
    }
  });

  it('renders with accessibility roles and labels', () => {
    render(<TabsHarness accessibilityLabel='Species tabs' />);

    const tabList = screen.getByLabelText('Species tabs');
    expect(tabList).toBeDefined();
    expect(tabList.props.accessibilityRole).toBe('tablist');
    expect(tabList.props.accessibilityLabel).toBe('Species tabs');

    const tab = screen.getByLabelText('One');
    expect(tab.props.accessibilityRole).toBe('tab');
    expect(tab.props.accessibilityState?.selected).toBe(true);
  });

  it('emits selection change when pressing a different tab', () => {
    const onSelectionChange = jest.fn();
    render(<TabsHarness onSelectionChange={onSelectionChange} />);

    fireEvent.press(screen.getByLabelText('Two'));
    expect(onSelectionChange).toHaveBeenCalledWith('two');
  });

  it('does not emit selection change when pressing the active tab', () => {
    const onSelectionChange = jest.fn();
    render(<TabsHarness onSelectionChange={onSelectionChange} />);

    fireEvent.press(screen.getByLabelText('One'));
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('moves focus with ArrowRight and ArrowLeft keys without changing selection', () => {
    setPlatformOS('web');
    const onSelectionChange = jest.fn();
    render(<TabsHarness onSelectionChange={onSelectionChange} />);

    const tabOne = screen.getByLabelText('One');
    fireEvent(tabOne, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });
    expect(onSelectionChange).not.toHaveBeenCalled();

    const tabTwo = screen.getByLabelText('Two');
    expect(tabTwo.props.tabIndex).toBe(0);
    expect(tabOne.props.tabIndex).toBe(-1);

    fireEvent(tabTwo, 'keyDown', { nativeEvent: { key: 'ArrowLeft' } });
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(tabOne.props.tabIndex).toBe(0);
    expect(tabTwo.props.tabIndex).toBe(-1);
  });

  it('wraps focus on ArrowLeft from the first tab', () => {
    setPlatformOS('web');
    const onSelectionChange = jest.fn();
    render(<TabsHarness onSelectionChange={onSelectionChange} />);

    const tabOne = screen.getByLabelText('One');
    fireEvent(tabOne, 'keyDown', { nativeEvent: { key: 'ArrowLeft' } });
    expect(onSelectionChange).not.toHaveBeenCalled();

    const tabFour = screen.getByLabelText('Four');
    expect(tabFour.props.tabIndex).toBe(0);
    expect(tabOne.props.tabIndex).toBe(-1);
  });

  it('wraps focus on ArrowRight from the last tab', () => {
    setPlatformOS('web');
    const onSelectionChange = jest.fn();
    render(
      <TabsHarness initialKey='four' onSelectionChange={onSelectionChange} />,
    );

    const tabFour = screen.getByLabelText('Four');
    fireEvent(tabFour, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });
    expect(onSelectionChange).not.toHaveBeenCalled();

    const tabOne = screen.getByLabelText('One');
    expect(tabOne.props.tabIndex).toBe(0);
    expect(tabFour.props.tabIndex).toBe(-1);
  });

  it('activates selection on Enter and Space using the focused tab', () => {
    setPlatformOS('web');
    const onSelectionChange = jest.fn();
    render(<TabsHarness onSelectionChange={onSelectionChange} />);

    const tabOne = screen.getByLabelText('One');
    const tabTwo = screen.getByLabelText('Two');

    fireEvent(tabOne, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });
    fireEvent(tabOne, 'keyDown', { nativeEvent: { key: 'Enter' } });
    expect(onSelectionChange).toHaveBeenNthCalledWith(1, 'two');

    fireEvent(tabTwo, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });
    fireEvent(tabTwo, 'keyDown', { nativeEvent: { key: ' ' } });
    expect(onSelectionChange).toHaveBeenNthCalledWith(2, 'three');
  });

  it('renders separators between non-active tabs', () => {
    setPlatformOS('web');
    render(<TabsHarness initialKey='one' />);

    expect(screen.getByTestId('tabs-separator-1')).toBeDefined();
    expect(screen.getByTestId('tabs-separator-2')).toBeDefined();
  });

  it('skips separator adjacent to the active tab', () => {
    setPlatformOS('web');
    render(<TabsHarness initialKey='two' />);

    const separator = screen.getByTestId('tabs-separator-0');
    const style = StyleSheet.flatten(separator.props.style);
    expect(style.opacity).toBe(0);
  });

  it('does not render separator hosts on native', () => {
    render(<TabsHarness initialKey='one' />);

    expect(screen.queryByTestId('tabs-separator-0')).toBeNull();
    expect(screen.queryByTestId('tabs-separator-1')).toBeNull();
    expect(screen.queryByTestId('tabs-separator-2')).toBeNull();
  });

  it('keeps a single scroll host mounted while layout mode changes', () => {
    setPlatformOS('web');

    const rendered = render(<TabsHarness initialKey='one' />);
    expect(screen.getAllByTestId('tabs-scroll-host')).toHaveLength(1);
    expect(screen.getByTestId('tabs-scroll-host').props.scrollEnabled).toBe(
      true,
    );

    fireEvent(screen.getByLabelText('Example Tabs'), 'layout', {
      nativeEvent: { layout: { width: 1200, height: 48 } },
    });
    fireEvent(screen.getByLabelText('One'), 'layout', {
      nativeEvent: { layout: { width: 120, height: 24 } },
    });
    fireEvent(screen.getByLabelText('Two'), 'layout', {
      nativeEvent: { layout: { width: 120, height: 24 } },
    });
    fireEvent(screen.getByLabelText('Three'), 'layout', {
      nativeEvent: { layout: { width: 120, height: 24 } },
    });
    fireEvent(screen.getByLabelText('Four'), 'layout', {
      nativeEvent: { layout: { width: 120, height: 24 } },
    });

    expect(screen.getByTestId('tabs-scroll-host').props.scrollEnabled).toBe(
      false,
    );

    rendered.rerender(<TabsHarness initialKey='two' />);
    expect(screen.getAllByTestId('tabs-scroll-host')).toHaveLength(1);
    expect(screen.getByTestId('tabs-scroll-host').props.scrollEnabled).toBe(
      false,
    );
  });

  it('only exposes overflow after measurement completes, regardless of scroll mode', () => {
    setPlatformOS('web');

    render(<TabsHarness initialKey='one' />);

    const initialScrollHost = screen.getByTestId('tabs-scroll-host');
    expect(initialScrollHost.props.scrollEnabled).toBe(true);
    expect(toStyleArray(initialScrollHost.props.style)).not.toContainEqual(
      expect.objectContaining({ overflow: 'visible' }),
    );
    expect(
      toStyleArray(initialScrollHost.props.contentContainerStyle),
    ).not.toContainEqual(expect.objectContaining({ overflow: 'visible' }));

    fireEvent(screen.getByLabelText('Example Tabs'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 48 } },
    });
    fireEvent(screen.getByLabelText('One'), 'layout', {
      nativeEvent: { layout: { width: 120, height: 24 } },
    });
    fireEvent(screen.getByLabelText('Two'), 'layout', {
      nativeEvent: { layout: { width: 120, height: 24 } },
    });
    fireEvent(screen.getByLabelText('Three'), 'layout', {
      nativeEvent: { layout: { width: 120, height: 24 } },
    });
    fireEvent(screen.getByLabelText('Four'), 'layout', {
      nativeEvent: { layout: { width: 120, height: 24 } },
    });

    const scrollingHost = screen.getByTestId('tabs-scroll-host');
    expect(scrollingHost.props.scrollEnabled).toBe(true);
    expect(toStyleArray(scrollingHost.props.style)).toContainEqual(
      expect.objectContaining({ overflow: 'visible' }),
    );
    expect(
      toStyleArray(scrollingHost.props.contentContainerStyle),
    ).toContainEqual(expect.objectContaining({ overflow: 'visible' }));

    fireEvent(screen.getByLabelText('Example Tabs'), 'layout', {
      nativeEvent: { layout: { width: 1200, height: 48 } },
    });

    const fixedHost = screen.getByTestId('tabs-scroll-host');
    expect(fixedHost.props.scrollEnabled).toBe(false);
    expect(toStyleArray(fixedHost.props.style)).toContainEqual(
      expect.objectContaining({ overflow: 'visible' }),
    );
    expect(toStyleArray(fixedHost.props.contentContainerStyle)).toContainEqual(
      expect.objectContaining({ overflow: 'visible' }),
    );
  });
});

describe('computeTabLayout', () => {
  const computeTabLayout = __TABS_TESTING__.computeTabLayout;
  const baseArgs = {
    tabs,
    containerWidth: 400,
    labelWidths: { one: 10, two: 10, three: 10, four: 10 },
    horizontalPadding: 20,
  };

  it('returns empty layout when width or tabs are missing', () => {
    expect(
      computeTabLayout({
        ...baseArgs,
        containerWidth: 0,
      }),
    ).toEqual({ tabWidths: {}, shouldScroll: false });

    expect(
      computeTabLayout({
        ...baseArgs,
        tabs: [],
      }),
    ).toEqual({ tabWidths: {}, shouldScroll: false });
  });

  it('distributes tab widths evenly when all labels fit without scrolling', () => {
    const { tabWidths, shouldScroll } = computeTabLayout(baseArgs);
    expect(shouldScroll).toBe(false);
    expect(tabWidths.one).toBeCloseTo(100);
    expect(tabWidths.two).toBeCloseTo(100);
    expect(tabWidths.three).toBeCloseTo(100);
    expect(tabWidths.four).toBeCloseTo(100);
  });

  it('allocates extra width on top of required content width in non-scroll mode', () => {
    const { tabWidths, shouldScroll } = computeTabLayout({
      ...baseArgs,
      tabs: [
        { key: 'one', label: 'One' },
        { key: 'two', label: 'Two' },
        { key: 'three', label: 'Three' },
      ],
      containerWidth: 360,
      labelWidths: { one: 100, two: 60, three: 60 },
      horizontalPadding: 20,
    });

    expect(shouldScroll).toBe(false);
    expect(tabWidths.one).toBeCloseTo(146.666, 2);
    expect(tabWidths.two).toBeCloseTo(106.666, 2);
    expect(tabWidths.three).toBeCloseTo(106.666, 2);
  });

  it('shrinks shorter tabs first when slack can cover deficits', () => {
    const { tabWidths, shouldScroll } = computeTabLayout({
      ...baseArgs,
      tabs: [
        { key: 'one', label: 'One' },
        { key: 'two', label: 'Two' },
        { key: 'three', label: 'Three' },
      ],
      containerWidth: 300,
      labelWidths: { one: 100, two: 60, three: 60 },
      horizontalPadding: 20,
    });

    expect(shouldScroll).toBe(false);
    expect(tabWidths.one).toBeCloseTo(120);
    expect(tabWidths.two).toBeCloseTo(90);
    expect(tabWidths.three).toBeCloseTo(90);
  });

  it('enables scroll when deficit exceeds slack', () => {
    const { tabWidths, shouldScroll } = computeTabLayout({
      ...baseArgs,
      tabs: [
        { key: 'one', label: 'One' },
        { key: 'two', label: 'Two' },
        { key: 'three', label: 'Three' },
      ],
      containerWidth: 300,
      labelWidths: { one: 140, two: 60, three: 60 },
      horizontalPadding: 20,
    });

    expect(shouldScroll).toBe(true);
    expect(tabWidths.one).toBeCloseTo(160);
    expect(tabWidths.two).toBeCloseTo(80);
    expect(tabWidths.three).toBeCloseTo(80);
  });

  it('applies minimum tab width when scrolling, without forcing scroll by itself', () => {
    const { tabWidths, shouldScroll } = computeTabLayout({
      ...baseArgs,
      tabs: [
        { key: 'one', label: 'One' },
        { key: 'two', label: 'Two' },
        { key: 'three', label: 'Three' },
      ],
      containerWidth: 240,
      labelWidths: { one: 200, two: 10, three: 10 },
      horizontalPadding: 20,
      minimumTabWidth: 96,
    });

    expect(shouldScroll).toBe(true);
    expect(tabWidths.one).toBeCloseTo(220);
    expect(tabWidths.two).toBeCloseTo(96);
    expect(tabWidths.three).toBeCloseTo(96);
  });
});
