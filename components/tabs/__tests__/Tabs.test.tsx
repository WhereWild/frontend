import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Tabs, __TABS_TESTING__ } from '../Tabs';

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
  it('renders with accessibility roles and labels', () => {
    render(<TabsHarness accessibilityLabel="Species tabs" />);

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

    fireEvent.press(screen.getByText('Two'));
    expect(onSelectionChange).toHaveBeenCalledWith('two');
  });

  it('does not emit selection change when pressing the active tab', () => {
    const onSelectionChange = jest.fn();
    render(<TabsHarness onSelectionChange={onSelectionChange} />);

    fireEvent.press(screen.getByText('One'));
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('moves focus with ArrowRight and ArrowLeft keys without changing selection', () => {
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
    const onSelectionChange = jest.fn();
    render(<TabsHarness initialKey="four" onSelectionChange={onSelectionChange} />);

    const tabFour = screen.getByLabelText('Four');
    fireEvent(tabFour, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });
    expect(onSelectionChange).not.toHaveBeenCalled();

    const tabOne = screen.getByLabelText('One');
    expect(tabOne.props.tabIndex).toBe(0);
    expect(tabFour.props.tabIndex).toBe(-1);
  });

  it('activates selection on Enter and Space using the focused tab', () => {
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
    render(<TabsHarness initialKey="one" />);

    expect(screen.getByTestId('tabs-separator-1')).toBeDefined();
    expect(screen.getByTestId('tabs-separator-2')).toBeDefined();
  });

  it('skips separator adjacent to the active tab', () => {
    render(<TabsHarness initialKey="two" />);

    expect(screen.queryByTestId('tabs-separator-0')).toBeNull();
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
      })
    ).toEqual({ tabWidths: {}, shouldScroll: false });

    expect(
      computeTabLayout({
        ...baseArgs,
        tabs: [],
      })
    ).toEqual({ tabWidths: {}, shouldScroll: false });
  });

  it('uses equal widths when all labels fit', () => {
    const { tabWidths, shouldScroll } = computeTabLayout(baseArgs);
    expect(shouldScroll).toBe(false);
    expect(tabWidths.one).toBeCloseTo(100);
    expect(tabWidths.two).toBeCloseTo(100);
    expect(tabWidths.three).toBeCloseTo(100);
    expect(tabWidths.four).toBeCloseTo(100);
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
});
