import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet, type PressableProps, type View } from 'react-native';
import { NavigationPillList } from '../NavigationPillList';

jest.mock('../NavigationPill', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const ReactNative = jest.requireActual<typeof import('react-native')>('react-native');
  const PressableWithKeyDown = ReactNative.Pressable as unknown as React.ForwardRefExoticComponent<
    PressableProps & {
      onKeyDown?: (event: { nativeEvent?: { key?: string }; preventDefault?: () => void }) => void;
      tabIndex?: 0 | -1;
    } & React.RefAttributes<View>
  >;

  const NavigationPill = React.forwardRef((props: any, ref: React.ForwardedRef<{ focus: () => void }>) => {
    const {
      id,
      label,
      isActive,
      onPress,
      onKeyDown,
      onFocus,
      focusable,
      tabIndex,
      accessibilityLabel,
      testID,
    } = props;

    React.useImperativeHandle(ref, () => ({
      focus: () => {
        onFocus?.();
      },
    }), [onFocus]);

    return (
      <PressableWithKeyDown
        accessibilityRole="radio"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected: isActive }}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        focusable={focusable}
        tabIndex={tabIndex}
        onPress={() => onPress(id)}
        testID={testID ?? `pill-${id}`}
      >
        {label}
      </PressableWithKeyDown>
    );
  });

  NavigationPill.displayName = 'MockNavigationPill';

  return { NavigationPill };
});

const pills = [
  { key: 'one', label: 'One' },
  { key: 'two', label: 'Two' },
  { key: 'three', label: 'Three' },
  { key: 'four', label: 'Four' },
];

const PillListHarness = ({
  initialKey = 'one',
  pillsOverride,
  onSelectionChange,
  direction = 'horizontal',
  accessibilityLabel = 'Navigation pills',
  onFocusRequest,
}: {
  initialKey?: string;
  pillsOverride?: typeof pills;
  onSelectionChange?: (key: string) => void;
  direction?: 'horizontal' | 'vertical';
  accessibilityLabel?: string;
  onFocusRequest?: (index: number) => void;
}) => {
  const [selectedKey, setSelectedKey] = useState(initialKey);
  return (
    <NavigationPillList
      pills={pillsOverride ?? pills}
      selectedKey={selectedKey}
      direction={direction}
      accessibilityLabel={accessibilityLabel}
      onFocusRequest={onFocusRequest}
      onSelectionChange={(key) => {
        onSelectionChange?.(key);
        setSelectedKey(key);
      }}
    />
  );
};

describe('NavigationPillList', () => {
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

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

  it('renders with accessibility role and label', () => {
    render(<PillListHarness accessibilityLabel="Pill group" />);

    const list = screen.getByLabelText('Pill group');
    expect(list.props.accessibilityRole).toBe('radiogroup');

    const pill = screen.getByLabelText('One');
    expect(pill.props.accessibilityRole).toBe('radio');
    expect(pill.props.accessibilityState?.selected).toBe(true);
  });

  it('emits selection change when pressing a different pill', () => {
    const onSelectionChange = jest.fn();
    render(<PillListHarness onSelectionChange={onSelectionChange} />);

    fireEvent.press(screen.getByLabelText('Two'));
    expect(onSelectionChange).toHaveBeenCalledWith('two');
  });

  it('does not emit selection change when pressing the active pill', () => {
    const onSelectionChange = jest.fn();
    render(<PillListHarness onSelectionChange={onSelectionChange} />);

    fireEvent.press(screen.getByLabelText('One'));
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('allows native horizontal pills to wrap onto additional rows', () => {
    render(<PillListHarness />);

    const list = screen.getByLabelText('Navigation pills');
    const style = StyleSheet.flatten(list.props.style);

    expect(style.flexDirection).toBe('row');
    expect(style.flexWrap).toBe('wrap');
  });

  it('keeps native horizontal pill wrappers mounted when the visible pill set shrinks', () => {
    setPlatformOS('ios');
    const rendered = render(
      <PillListHarness pillsOverride={pills.slice(0, 3)} initialKey="one" />,
    );

    const countHiddenWrappers = () => rendered.UNSAFE_root.findAll(
      (node) => typeof node.type === 'string' && node.props?.accessibilityElementsHidden === true,
    ).length;

    expect(countHiddenWrappers()).toBe(0);

    rendered.rerender(
      <PillListHarness pillsOverride={pills.slice(0, 2)} initialKey="one" />,
    );

    expect(countHiddenWrappers()).toBeGreaterThan(0);

    const hiddenWrapper = rendered.UNSAFE_root.find(
      (node) => typeof node.type === 'string' && node.props?.accessibilityElementsHidden === true,
    );
    const hiddenWrapperStyle = StyleSheet.flatten(hiddenWrapper.props.style);

    expect(hiddenWrapperStyle.marginRight).toBe(0);
    expect(hiddenWrapperStyle.marginBottom).toBe(0);
  });

  it('preserves the caller pill order when horizontal native rows reorder existing keys', () => {
    setPlatformOS('ios');
    const reorderedPills = [pills[2], pills[0], pills[1]];
    const rendered = render(
      <PillListHarness pillsOverride={pills.slice(0, 3)} initialKey="one" />,
    );

    rendered.rerender(
      <PillListHarness pillsOverride={reorderedPills} initialKey="three" />,
    );

    const pillIds = rendered.UNSAFE_root.findAll(
      (node) => typeof node.type === 'string' && /^pill-/.test(node.props?.testID ?? ''),
    ).map((node) => node.props.testID);

    expect(pillIds.slice(0, 3)).toEqual(['pill-three', 'pill-one', 'pill-two']);
  });

  it('moves focus horizontally with arrow keys without changing selection', () => {
    setPlatformOS('web');
    const onSelectionChange = jest.fn();
    const onFocusRequest = jest.fn();
    render(
      <PillListHarness
        onSelectionChange={onSelectionChange}
        onFocusRequest={onFocusRequest}
      />
    );

    const pillOne = screen.getByLabelText('One');
    fireEvent(pillOne, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });
    expect(onSelectionChange).not.toHaveBeenCalled();

    const pillTwo = screen.getByLabelText('Two');
    expect(pillTwo.props.tabIndex).toBe(0);
    expect(pillOne.props.tabIndex).toBe(-1);
    expect(onFocusRequest).toHaveBeenCalledWith(1);

    fireEvent(pillTwo, 'keyDown', { nativeEvent: { key: 'ArrowLeft' } });
    expect(pillOne.props.tabIndex).toBe(0);
    expect(pillTwo.props.tabIndex).toBe(-1);
    expect(onFocusRequest).toHaveBeenCalledWith(0);
  });

  it('requests focus on the next pill when navigating', () => {
    setPlatformOS('web');
    const onFocusRequest = jest.fn();
    render(<PillListHarness onFocusRequest={onFocusRequest} />);

    const pillOne = screen.getByLabelText('One');
    fireEvent(pillOne, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });

    expect(onFocusRequest).toHaveBeenCalledWith(1);
  });

  it('wraps focus horizontally from the first pill', () => {
    setPlatformOS('web');
    const onSelectionChange = jest.fn();
    render(<PillListHarness onSelectionChange={onSelectionChange} />);

    const pillOne = screen.getByLabelText('One');
    fireEvent(pillOne, 'keyDown', { nativeEvent: { key: 'ArrowLeft' } });

    const pillFour = screen.getByLabelText('Four');
    expect(pillFour.props.tabIndex).toBe(0);
    expect(pillOne.props.tabIndex).toBe(-1);
  });

  it('moves focus vertically with arrow keys', () => {
    setPlatformOS('web');
    const onSelectionChange = jest.fn();
    render(<PillListHarness direction="vertical" onSelectionChange={onSelectionChange} />);

    const pillOne = screen.getByLabelText('One');
    fireEvent(pillOne, 'keyDown', { nativeEvent: { key: 'ArrowDown' } });

    const pillTwo = screen.getByLabelText('Two');
    expect(pillTwo.props.tabIndex).toBe(0);
    expect(pillOne.props.tabIndex).toBe(-1);

    fireEvent(pillTwo, 'keyDown', { nativeEvent: { key: 'ArrowUp' } });
    expect(pillOne.props.tabIndex).toBe(0);
    expect(pillTwo.props.tabIndex).toBe(-1);
  });

  it('activates selection with Enter and Space using focused pill', () => {
    setPlatformOS('web');
    const onSelectionChange = jest.fn();
    render(<PillListHarness onSelectionChange={onSelectionChange} />);

    const pillOne = screen.getByLabelText('One');
    const pillTwo = screen.getByLabelText('Two');

    fireEvent(pillOne, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });
    fireEvent(pillTwo, 'keyDown', { nativeEvent: { key: 'Enter' } });
    expect(onSelectionChange).toHaveBeenNthCalledWith(1, 'two');

    fireEvent(pillTwo, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });
    const pillThree = screen.getByLabelText('Three');
    fireEvent(pillThree, 'keyDown', { nativeEvent: { key: ' ' } });
    expect(onSelectionChange).toHaveBeenNthCalledWith(2, 'three');
  });
});
