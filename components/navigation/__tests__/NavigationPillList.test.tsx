import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationPillList } from '../NavigationPillList';

const pills = [
  { key: 'one', label: 'One' },
  { key: 'two', label: 'Two' },
  { key: 'three', label: 'Three' },
  { key: 'four', label: 'Four' },
];

const PillListHarness = ({
  initialKey = 'one',
  onSelectionChange,
  direction = 'horizontal',
  accessibilityLabel = 'Navigation pills',
  onFocusRequest,
}: {
  initialKey?: string;
  onSelectionChange?: (key: string) => void;
  direction?: 'horizontal' | 'vertical';
  accessibilityLabel?: string;
  onFocusRequest?: (index: number) => void;
}) => {
  const [selectedKey, setSelectedKey] = useState(initialKey);
  return (
    <NavigationPillList
      pills={pills}
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

  it('moves focus horizontally with arrow keys without changing selection', () => {
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
    const onFocusRequest = jest.fn();
    render(<PillListHarness onFocusRequest={onFocusRequest} />);

    const pillOne = screen.getByLabelText('One');
    fireEvent(pillOne, 'keyDown', { nativeEvent: { key: 'ArrowRight' } });

    expect(onFocusRequest).toHaveBeenCalledWith(1);
  });

  it('wraps focus horizontally from the first pill', () => {
    const onSelectionChange = jest.fn();
    render(<PillListHarness onSelectionChange={onSelectionChange} />);

    const pillOne = screen.getByLabelText('One');
    fireEvent(pillOne, 'keyDown', { nativeEvent: { key: 'ArrowLeft' } });

    const pillFour = screen.getByLabelText('Four');
    expect(pillFour.props.tabIndex).toBe(0);
    expect(pillOne.props.tabIndex).toBe(-1);
  });

  it('moves focus vertically with arrow keys', () => {
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
