// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import * as Haptics from 'expo-haptics';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import renderer from 'react-test-renderer';
import { Animated, NativeModules, Platform, StyleSheet } from 'react-native';
import { Size, Time } from '@/constants/theme';
import { IconButton } from '@/components/buttons/IconButton';
import { NumberSpinner } from '../NumberSpinner';

const USE_NATIVE_DRIVER =
  Platform.OS !== 'web' && !!NativeModules.NativeAnimatedModule;
const mockImpactAsync = Haptics.impactAsync as jest.MockedFunction<
  typeof Haptics.impactAsync
>;
const mockSelectionAsync = Haptics.selectionAsync as jest.MockedFunction<
  typeof Haptics.selectionAsync
>;

const createTimingToValueMock = () => {
  let lastToValue: number | null = null;

  const timingSpy = jest
    .spyOn(Animated, 'timing')
    .mockImplementation((value, config) => {
      return {
        start: (callback?: (result: { finished: boolean }) => void) => {
          const targetValue = config.toValue as number;
          (value as Animated.Value).setValue(targetValue);
          lastToValue = targetValue;
          callback?.({ finished: true });
        },
      } as any;
    });

  return {
    timingSpy,
    getLastToValue: () => lastToValue,
  };
};

describe('NumberSpinner', () => {
  afterEach(() => {
    mockImpactAsync.mockClear();
    mockSelectionAsync.mockClear();
    jest.restoreAllMocks();
  });

  it('renders label and description', () => {
    render(<NumberSpinner label='Label' description='Description' value={3} />);

    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  it('disables decrement button at minimum value', () => {
    render(<NumberSpinner value={1} min={1} max={10} />);

    const decrementButton = screen.getByLabelText('Decrease value');
    expect(decrementButton.props.accessibilityState.disabled).toBe(true);
  });

  it('disables increment button at maximum value', () => {
    render(<NumberSpinner value={10} min={1} max={10} />);

    const incrementButton = screen.getByLabelText('Increase value');
    expect(incrementButton.props.accessibilityState.disabled).toBe(true);
  });

  it('calls onValueChange with context when incremented and decremented', () => {
    const handleValueChange = jest.fn();

    const { rerender } = render(
      <NumberSpinner
        value={5}
        min={1}
        max={10}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Increase value'));
    expect(handleValueChange).toHaveBeenCalledWith(6, 'increment');
    expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).not.toHaveBeenCalled();

    rerender(
      <NumberSpinner
        value={6}
        min={1}
        max={10}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Decrease value'));
    expect(handleValueChange).toHaveBeenCalledWith(5, 'decrement');
    expect(mockSelectionAsync).toHaveBeenCalledTimes(2);
    expect(mockImpactAsync).not.toHaveBeenCalled();
  });

  it('updates internal value when uncontrolled', () => {
    render(<NumberSpinner defaultValue={2} min={1} max={10} />);

    fireEvent.press(screen.getByLabelText('Increase value'));

    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  it('decrements internal value when uncontrolled', () => {
    render(<NumberSpinner defaultValue={4} min={1} max={10} />);

    fireEvent.press(screen.getByLabelText('Decrease value'));

    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  it('only accepts numeric input characters', () => {
    const handleValueChange = jest.fn();

    render(
      <NumberSpinner defaultValue={1} onValueChange={handleValueChange} />,
    );

    const input = screen.getByLabelText('Spinner value');
    fireEvent.changeText(input, 'a1b2c3');

    expect(screen.getByDisplayValue('123')).toBeTruthy();
    expect(handleValueChange).toHaveBeenCalledWith(123, 'input');
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it('clamps out-of-bound typed values', () => {
    const handleValueChange = jest.fn();

    render(
      <NumberSpinner
        value={5}
        min={1}
        max={10}
        onValueChange={handleValueChange}
      />,
    );

    const input = screen.getByLabelText('Spinner value');
    fireEvent.changeText(input, '42');

    expect(screen.getByDisplayValue('10')).toBeTruthy();
    expect(handleValueChange).toHaveBeenCalledWith(10, 'input');
  });

  it('accepts negative typed values when min allows negatives', () => {
    const handleValueChange = jest.fn();

    render(
      <NumberSpinner
        value={0}
        min={-10}
        max={10}
        onValueChange={handleValueChange}
      />,
    );

    const input = screen.getByLabelText('Spinner value');
    fireEvent.changeText(input, '-7');

    expect(screen.getByDisplayValue('-7')).toBeTruthy();
    expect(handleValueChange).toHaveBeenCalledWith(-7, 'input');
  });

  it('restores the current value when input is cleared then blurred', () => {
    render(<NumberSpinner defaultValue={3} min={1} max={10} />);

    const input = screen.getByLabelText('Spinner value');
    fireEvent.changeText(input, '');
    fireEvent(input, 'blur');

    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  it('uses the step prop for increment and decrement', () => {
    render(<NumberSpinner defaultValue={2} min={0} max={10} step={2} />);

    fireEvent.press(screen.getByLabelText('Increase value'));
    expect(screen.getByDisplayValue('4')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Decrease value'));
    expect(screen.getByDisplayValue('2')).toBeTruthy();
  });

  it('prevents interactions when disabled', () => {
    const handleValueChange = jest.fn();

    render(
      <NumberSpinner
        value={5}
        min={1}
        max={10}
        disabled
        onValueChange={handleValueChange}
      />,
    );

    const input = screen.getByLabelText('Spinner value');
    expect(input.props.editable).toBe(false);
    expect(input.props.focusable).toBe(false);

    const incrementButton = screen.getByLabelText('Increase value');
    const decrementButton = screen.getByLabelText('Decrease value');

    fireEvent.press(incrementButton);
    fireEvent.press(decrementButton);

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it('does not trigger haptics when a step press is clamped to the current value', () => {
    const handleValueChange = jest.fn();

    render(
      <NumberSpinner
        value={10}
        min={1}
        max={10}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Increase value'));

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(mockImpactAsync).not.toHaveBeenCalled();
    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it('triggers a medium impact when increment lands on the maximum value', () => {
    const handleValueChange = jest.fn();

    render(
      <NumberSpinner
        value={9}
        min={1}
        max={10}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Increase value'));

    expect(handleValueChange).toHaveBeenCalledWith(10, 'increment');
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium,
    );
    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it('triggers a medium impact when decrement lands on the minimum value', () => {
    const handleValueChange = jest.fn();

    render(
      <NumberSpinner
        value={2}
        min={1}
        max={10}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Decrease value'));

    expect(handleValueChange).toHaveBeenCalledWith(1, 'decrement');
    expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    expect(mockImpactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium,
    );
    expect(mockSelectionAsync).not.toHaveBeenCalled();
  });

  it('uses medium control height for the spinner pill', () => {
    render(<NumberSpinner value={3} label='Height Test' />);

    const spinner = screen.getByLabelText('Height Test');
    const flattenedStyle = StyleSheet.flatten(spinner.props.style);

    expect(flattenedStyle.height).toBe(Size.control.height.medium);
  });

  it('selects text on focus and hints numeric input mode', () => {
    render(<NumberSpinner value={3} />);

    const input = screen.getByLabelText('Spinner value');
    expect(input.props.selectTextOnFocus).toBe(true);
    expect(input.props.inputMode).toBe('numeric');
  });

  it('lets icon buttons control spinner icon colors', () => {
    let testRenderer!: renderer.ReactTestRenderer;

    act(() => {
      testRenderer = renderer.create(
        <NumberSpinner value={3} min={1} max={10} />,
      );
    });

    const iconButtons = testRenderer.root.findAllByType(IconButton);

    expect(iconButtons).toHaveLength(2);
    expect(iconButtons[0].props.icon.props.color).toBeUndefined();
    expect(iconButtons[1].props.icon.props.color).toBeUndefined();
  });

  it('animates hover overlay in and out using short timing', () => {
    const { timingSpy, getLastToValue } = createTimingToValueMock();

    let testRenderer!: renderer.ReactTestRenderer;
    act(() => {
      testRenderer = renderer.create(
        <NumberSpinner label='Animated spinner' value={3} />,
      );
    });

    const spinner = testRenderer.root.findByProps({
      accessibilityLabel: 'Animated spinner',
    });
    timingSpy.mockClear();

    act(() => {
      spinner.props.onHoverIn?.({} as any);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 1,
        duration: Time.duration.short,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    expect(getLastToValue()).toBe(1);

    act(() => {
      spinner.props.onHoverOut?.({} as any);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 0,
        duration: Time.duration.short,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    );
    expect(getLastToValue()).toBe(0);
  });

  it('repeats increment while holding and stops on release', () => {
    jest.useFakeTimers();
    const repeatIntervalMs = 100;
    const threeRepeatTicksMs = repeatIntervalMs * 3;
    const postReleaseWaitMs = 300;

    try {
      render(<NumberSpinner defaultValue={1} min={1} max={10} />);

      const incrementButton = screen.getByLabelText('Increase value');

      fireEvent(incrementButton, 'onLongPress');
      expect(screen.getByDisplayValue('2')).toBeTruthy();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(1);

      act(() => {
        // onLongPress has already fired; advancing 300ms triggers 3 repeat ticks.
        jest.advanceTimersByTime(threeRepeatTicksMs);
      });

      expect(screen.getByDisplayValue('5')).toBeTruthy();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(4);
      expect(mockImpactAsync).not.toHaveBeenCalled();

      fireEvent(incrementButton, 'onPressOut');

      act(() => {
        jest.advanceTimersByTime(postReleaseWaitMs);
      });

      expect(screen.getByDisplayValue('5')).toBeTruthy();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(4);
      expect(mockImpactAsync).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('triggers a medium impact when increment hold lands on the maximum value', () => {
    jest.useFakeTimers();

    try {
      render(<NumberSpinner defaultValue={7} min={1} max={10} />);

      const incrementButton = screen.getByLabelText('Increase value');

      fireEvent(incrementButton, 'onLongPress');
      expect(screen.getByDisplayValue('8')).toBeTruthy();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(screen.getByDisplayValue('10')).toBeTruthy();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(2);
      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('repeats decrement while holding and stops on release', () => {
    jest.useFakeTimers();
    const repeatIntervalMs = 100;
    const threeRepeatTicksMs = repeatIntervalMs * 3;
    const postReleaseWaitMs = 300;

    try {
      render(<NumberSpinner defaultValue={4} min={1} max={10} />);

      const decrementButton = screen.getByLabelText('Decrease value');

      fireEvent(decrementButton, 'onLongPress');
      expect(screen.getByDisplayValue('3')).toBeTruthy();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).not.toHaveBeenCalled();

      act(() => {
        // onLongPress has already fired; advancing 300ms triggers 3 repeat ticks.
        jest.advanceTimersByTime(threeRepeatTicksMs);
      });

      expect(screen.getByDisplayValue('1')).toBeTruthy();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(2);
      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
      expect(mockImpactAsync).toHaveBeenCalledWith(
        Haptics.ImpactFeedbackStyle.Medium,
      );

      fireEvent(decrementButton, 'onPressOut');

      act(() => {
        jest.advanceTimersByTime(postReleaseWaitMs);
      });

      expect(screen.getByDisplayValue('1')).toBeTruthy();
      expect(mockSelectionAsync).toHaveBeenCalledTimes(2);
      expect(mockImpactAsync).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
