import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import renderer from 'react-test-renderer';
import { Animated, NativeModules, Platform, StyleSheet } from 'react-native';
import { Colors, Size, Time } from '@/constants/theme';
import { NumberSpinner } from '../NumberSpinner';

const USE_NATIVE_DRIVER = Platform.OS !== 'web' && !!NativeModules.NativeAnimatedModule;

const createTimingToValueMock = () => {
  let lastToValue: number | null = null;

  const timingSpy = jest.spyOn(Animated, 'timing').mockImplementation((value, config) => {
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
    jest.restoreAllMocks();
  });

  it('renders label and description', () => {
    render(
      <NumberSpinner
        label="Label"
        description="Description"
        value={3}
      />,
    );

    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  it('disables decrement button at minimum value', () => {
    render(
      <NumberSpinner
        value={1}
        min={1}
        max={10}
      />,
    );

    const decrementButton = screen.getByLabelText('Decrease value');
    expect(decrementButton.props.accessibilityState.disabled).toBe(true);
  });

  it('disables increment button at maximum value', () => {
    render(
      <NumberSpinner
        value={10}
        min={1}
        max={10}
      />,
    );

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
  });

  it('updates internal value when uncontrolled', () => {
    render(
      <NumberSpinner
        defaultValue={2}
        min={1}
        max={10}
      />,
    );

    fireEvent.press(screen.getByLabelText('Increase value'));

    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  it('decrements internal value when uncontrolled', () => {
    render(
      <NumberSpinner
        defaultValue={4}
        min={1}
        max={10}
      />,
    );

    fireEvent.press(screen.getByLabelText('Decrease value'));

    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  it('only accepts numeric input characters', () => {
    const handleValueChange = jest.fn();

    render(
      <NumberSpinner
        defaultValue={1}
        onValueChange={handleValueChange}
      />,
    );

    const input = screen.getByLabelText('Spinner value');
    fireEvent.changeText(input, 'a1b2c3');

    expect(screen.getByDisplayValue('123')).toBeTruthy();
    expect(handleValueChange).toHaveBeenCalledWith(123, 'input');
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
    render(
      <NumberSpinner
        defaultValue={3}
        min={1}
        max={10}
      />,
    );

    const input = screen.getByLabelText('Spinner value');
    fireEvent.changeText(input, '');
    fireEvent(input, 'blur');

    expect(screen.getByDisplayValue('3')).toBeTruthy();
  });

  it('uses the step prop for increment and decrement', () => {
    render(
      <NumberSpinner
        defaultValue={2}
        min={0}
        max={10}
        step={2}
      />,
    );

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
  });

  it('uses medium control height for the spinner pill', () => {
    render(<NumberSpinner value={3} label="Height Test" />);

    const spinner = screen.getByLabelText('Height Test');
    const flattenedStyle = StyleSheet.flatten(spinner.props.style);

    expect(flattenedStyle.height).toBe(Size.control.height.medium);
  });

  it('uses active background color while focused', () => {
    render(<NumberSpinner value={3} label="Active Test" />);

    const spinner = screen.getByLabelText('Active Test');
    const input = screen.getByLabelText('Spinner value');

    fireEvent(input, 'focus');

    const focusedStyle = StyleSheet.flatten(spinner.props.style);
    const focusedColor = focusedStyle.backgroundColor;
    const matchesLightModeFocusedColor =
      focusedColor === Colors.light.background.default.secondaryPressed;
    expect(
      focusedColor === Colors.light.background.default.secondaryPressed
      || focusedColor === Colors.dark.background.default.secondaryPressed,
    ).toBe(true);

    fireEvent(input, 'blur');

    const blurredStyle = StyleSheet.flatten(spinner.props.style);
    expect(blurredStyle.backgroundColor).toBe(
      matchesLightModeFocusedColor
        ? Colors.light.background.default.secondary
        : Colors.dark.background.default.secondary,
    );
  });

  it('selects text on focus and hints numeric input mode', () => {
    render(<NumberSpinner value={3} />);

    const input = screen.getByLabelText('Spinner value');
    expect(input.props.selectTextOnFocus).toBe(true);
    expect(input.props.inputMode).toBe('numeric');
  });

  it('animates hover overlay in and out using short timing', () => {
    const { timingSpy, getLastToValue } = createTimingToValueMock();

    let testRenderer!: renderer.ReactTestRenderer;
    act(() => {
      testRenderer = renderer.create(<NumberSpinner label="Animated spinner" value={3} />);
    });

    const spinner = testRenderer.root.findByProps({ accessibilityLabel: 'Animated spinner' });
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
      render(
        <NumberSpinner
          defaultValue={1}
          min={1}
          max={10}
        />,
      );

      const incrementButton = screen.getByLabelText('Increase value');

      fireEvent(incrementButton, 'onLongPress');
      expect(screen.getByDisplayValue('2')).toBeTruthy();

      act(() => {
        // onLongPress has already fired; advancing 300ms triggers 3 repeat ticks.
        jest.advanceTimersByTime(threeRepeatTicksMs);
      });

      expect(screen.getByDisplayValue('5')).toBeTruthy();

      fireEvent(incrementButton, 'onPressOut');

      act(() => {
        jest.advanceTimersByTime(postReleaseWaitMs);
      });

      expect(screen.getByDisplayValue('5')).toBeTruthy();
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
      render(
        <NumberSpinner
          defaultValue={4}
          min={1}
          max={10}
        />,
      );

      const decrementButton = screen.getByLabelText('Decrease value');

      fireEvent(decrementButton, 'onLongPress');
      expect(screen.getByDisplayValue('3')).toBeTruthy();

      act(() => {
        // onLongPress has already fired; advancing 300ms triggers 3 repeat ticks.
        jest.advanceTimersByTime(threeRepeatTicksMs);
      });

      expect(screen.getByDisplayValue('1')).toBeTruthy();

      fireEvent(decrementButton, 'onPressOut');

      act(() => {
        jest.advanceTimersByTime(postReleaseWaitMs);
      });

      expect(screen.getByDisplayValue('1')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
