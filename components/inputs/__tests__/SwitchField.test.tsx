import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import renderer, { act as rendererAct } from 'react-test-renderer';
import {
  Animated,
  PanResponder,
  processColor,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { SwitchField } from '../SwitchField';
import { Colors, Size, Time } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';

let panResponderConfig: Parameters<typeof PanResponder.create>[0] | null = null;
let lastTimingToValue: number | null = null;
let timingSpy: jest.SpyInstance | null = null;

const flattenStyles = (styles: unknown): unknown[] => {
  if (Array.isArray(styles)) {
    return styles.flatMap((style) => flattenStyles(style));
  }

  return styles == null ? [] : [styles];
};

const getStyleProperty = (
  styles: unknown,
  propertyName: string,
): string | number | undefined => {
  const flattenedStyles = flattenStyles(styles);

  for (let index = flattenedStyles.length - 1; index >= 0; index -= 1) {
    const style = flattenedStyles[index];
    if (typeof style === 'object' && style !== null && propertyName in style) {
      const value = (style as Record<string, unknown>)[propertyName];
      if (typeof value === 'string' || typeof value === 'number') {
        return value;
      }

      if (
        typeof value === 'object' &&
        value !== null &&
        '__getValue' in value &&
        typeof (value as { __getValue: () => unknown }).__getValue ===
          'function'
      ) {
        const resolvedValue = (
          value as { __getValue: () => unknown }
        ).__getValue();
        if (
          typeof resolvedValue === 'string' ||
          typeof resolvedValue === 'number'
        ) {
          return resolvedValue;
        }
      }
    }
  }
  return undefined;
};

const expectStyleColor = (
  styles: unknown,
  propertyName: string,
  expectedColor: string,
) => {
  expect(processColor(getStyleProperty(styles, propertyName) as string)).toBe(
    processColor(expectedColor),
  );
};

const expectStyleNumber = (
  styles: unknown,
  propertyName: string,
  expectedValue: number,
) => {
  expect(getStyleProperty(styles, propertyName)).toBe(expectedValue);
};

const getTimingSpyState = () => {
  if (timingSpy === null) {
    throw new Error('Animated.timing spy was not initialized');
  }

  return {
    timingSpy,
    getLastToValue: () => lastTimingToValue,
  };
};

const createGestureResponderEvent = (): GestureResponderEvent =>
  ({}) as GestureResponderEvent;

const createGestureState = (dx: number, dy = 0): PanResponderGestureState => ({
  _accountsForMovesUpTo: 0,
  dx,
  dy,
  moveX: dx,
  moveY: dy,
  numberActiveTouches: 1,
  stateID: 1,
  vx: 0,
  vy: 0,
  x0: 0,
  y0: 0,
});

describe('SwitchField', () => {
  beforeEach(() => {
    panResponderConfig = null;
    lastTimingToValue = null;
    timingSpy = null;
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    jest.spyOn(PanResponder, 'create').mockImplementation(
      (config: Parameters<typeof PanResponder.create>[0]) =>
        ({
          panHandlers: ((panResponderConfig = config), {}) as ReturnType<
            typeof PanResponder.create
          >['panHandlers'],
        }) as ReturnType<typeof PanResponder.create>,
    );
    timingSpy = jest
      .spyOn(Animated, 'timing')
      .mockImplementation((value, config) => {
        return {
          start: (callback?: (result: { finished: boolean }) => void) => {
            const targetValue = config.toValue as number;
            (value as Animated.Value).setValue(targetValue);
            lastTimingToValue = targetValue;
            callback?.({ finished: true });
          },
        } as any;
      });
  });

  afterEach(() => {
    timingSpy = null;
    jest.restoreAllMocks();
  });

  it('renders label and description when provided', () => {
    render(<SwitchField label='Label' description='Description' value />);

    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('calls onValueChange with the toggled value', () => {
    const handleValueChange = jest.fn();
    render(
      <SwitchField
        label='Notifications'
        value={false}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Notifications'));

    expect(handleValueChange).toHaveBeenCalledWith(true);
  });

  it('manages value internally when uncontrolled', () => {
    render(<SwitchField label='Auto Sync' defaultValue={false} />);

    const control = screen.getByLabelText('Auto Sync');
    expect(control.props.accessibilityState.checked).toBe(false);

    fireEvent.press(control);

    const toggledOnControl = screen.getByLabelText('Auto Sync');
    expect(toggledOnControl.props.accessibilityState.checked).toBe(true);

    fireEvent.press(toggledOnControl);

    expect(
      screen.getByLabelText('Auto Sync').props.accessibilityState.checked,
    ).toBe(false);
  });

  it('does not toggle when disabled', () => {
    const handleValueChange = jest.fn();
    render(
      <SwitchField
        label='Disabled toggle'
        value={false}
        disabled
        onValueChange={handleValueChange}
      />,
    );

    const control = screen.getByLabelText('Disabled toggle');
    fireEvent.press(control);

    expect(control.props.accessibilityState.disabled).toBe(true);
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('uses the full fill height for the disabled off thumb size', () => {
    const disabledOffThumbSize = Size.space['600'] - Size.space['150'];

    const { getByTestId } = render(
      <SwitchField label='Disabled off size' value={false} disabled />,
    );

    expect(
      getStyleProperty(getByTestId('switch-thumb').props.style, 'width'),
    ).toBe(disabledOffThumbSize);
    expect(
      getStyleProperty(getByTestId('switch-thumb').props.style, 'height'),
    ).toBe(disabledOffThumbSize);
  });

  it('renders without label and description', () => {
    render(<SwitchField value={false} />);

    expect(screen.getByLabelText('Switch field')).toBeTruthy();
    expect(screen.queryByText('Label')).toBeNull();
    expect(screen.queryByText('Description')).toBeNull();
  });

  it('renders the off state correctly in light mode', () => {
    const palette = Colors.light;

    (useColorScheme as jest.Mock).mockReturnValue('light');

    const { getByTestId } = render(
      <SwitchField label='Light mode switch' value={false} />,
    );

    expectStyleColor(
      getByTestId('switch-track').props.style,
      'backgroundColor',
      palette.background.default.secondary,
    );
    expectStyleColor(
      getByTestId('switch-border').props.style,
      'borderColor',
      palette.border.neutral.default,
    );
    expectStyleColor(
      getByTestId('switch-thumb').props.style,
      'backgroundColor',
      palette.icon.neutral.default,
    );
  });

  it('applies default and pressed track backgrounds', () => {
    const palette = Colors.dark;
    let testRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      testRenderer = renderer.create(
        <SwitchField label='State styles' value={false} />,
      );
    });

    const findTrackNode = () =>
      testRenderer!.root.findByProps({ testID: 'switch-track' });
    const findBorderNode = () =>
      testRenderer!.root.findByProps({ testID: 'switch-border' });

    const switchTrack = findTrackNode();
    const switchNode = testRenderer!.root.findByProps({
      accessibilityLabel: 'State styles',
    });
    const defaultStyle = switchTrack.props.style as unknown[];
    const defaultBorderStyle = findBorderNode().props.style as unknown[];

    act(() => {
      switchNode.props.onPressIn?.({} as any);
    });

    const pressedStyle = findTrackNode().props.style as unknown[];
    const pressedBorderStyle = findBorderNode().props.style as unknown[];

    expectStyleColor(
      defaultStyle,
      'backgroundColor',
      palette.background.default.secondary,
    );
    expectStyleColor(
      pressedStyle,
      'backgroundColor',
      palette.background.default.secondaryPressed,
    );
    expectStyleColor(
      defaultBorderStyle,
      'borderColor',
      palette.border.neutral.default,
    );
    expectStyleColor(
      pressedBorderStyle,
      'borderColor',
      palette.border.neutral.default,
    );
  });

  it('animates hover color overlay in and out using short timing', () => {
    const { timingSpy, getLastToValue } = getTimingSpyState();
    const palette = Colors.dark;

    let testRenderer!: renderer.ReactTestRenderer;
    act(() => {
      testRenderer = renderer.create(
        <SwitchField label='Hover animation' value={false} />,
      );
    });

    const control = testRenderer.root.findByProps({
      accessibilityLabel: 'Hover animation',
    });
    timingSpy.mockClear();

    act(() => {
      control.props.onHoverIn?.({} as any);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 1,
        duration: Time.duration.short,
        useNativeDriver: false,
      }),
    );
    expect(getLastToValue()).toBe(1);
    expectStyleColor(
      testRenderer.root.findByProps({ testID: 'switch-hover-fill' }).props
        .style,
      'backgroundColor',
      palette.background.default.secondaryHover,
    );
    expectStyleColor(
      testRenderer.root.findByProps({ testID: 'switch-hover-border' }).props
        .style,
      'borderColor',
      palette.border.neutral.default,
    );
    expectStyleNumber(
      testRenderer.root.findByProps({ testID: 'switch-hover-fill' }).props
        .style,
      'opacity',
      1,
    );

    act(() => {
      control.props.onHoverOut?.({} as any);
    });

    expect(timingSpy).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 0,
        duration: Time.duration.short,
        useNativeDriver: false,
      }),
    );
    expect(getLastToValue()).toBe(0);
    expectStyleNumber(
      testRenderer.root.findByProps({ testID: 'switch-hover-fill' }).props
        .style,
      'opacity',
      0,
    );
  });

  it('matches the border color to the fill color when hovered in the on state', () => {
    const { timingSpy } = getTimingSpyState();
    const palette = Colors.dark;
    let testRenderer!: renderer.ReactTestRenderer;

    act(() => {
      testRenderer = renderer.create(
        <SwitchField label='Hovered on switch' value />,
      );
    });

    const control = testRenderer.root.findByProps({
      accessibilityLabel: 'Hovered on switch',
    });
    timingSpy.mockClear();

    act(() => {
      control.props.onHoverIn?.({} as any);
    });

    expectStyleColor(
      testRenderer.root.findByProps({ testID: 'switch-hover-fill' }).props
        .style,
      'backgroundColor',
      palette.background.brand.hover,
    );
    expectStyleColor(
      testRenderer.root.findByProps({ testID: 'switch-hover-border' }).props
        .style,
      'borderColor',
      palette.background.brand.hover,
    );
    expectStyleNumber(
      testRenderer.root.findByProps({ testID: 'switch-hover-fill' }).props
        .style,
      'opacity',
      1,
    );
  });

  it('clears the hover overlay while the switch is pressed', () => {
    let testRenderer!: renderer.ReactTestRenderer;

    act(() => {
      testRenderer = renderer.create(
        <SwitchField label='Pressed hover switch' value={false} />,
      );
    });

    const control = testRenderer.root.findByProps({
      accessibilityLabel: 'Pressed hover switch',
    });

    act(() => {
      control.props.onHoverIn?.({} as any);
    });

    expectStyleNumber(
      testRenderer.root.findByProps({ testID: 'switch-hover-fill' }).props
        .style,
      'opacity',
      1,
    );

    act(() => {
      control.props.onPressIn?.({} as any);
    });

    expectStyleNumber(
      testRenderer.root.findByProps({ testID: 'switch-hover-fill' }).props
        .style,
      'opacity',
      0,
    );
  });

  it('animates thumb position with medium timing when value changes', () => {
    const { timingSpy, getLastToValue } = getTimingSpyState();
    const palette = Colors.dark;
    const offThumbSize =
      Size.space['600'] - 2 * Size.stroke.border - Size.space['150'];
    const onThumbSize = Size.space['600'] - Size.space['150'];

    const { rerender, getByTestId } = render(
      <SwitchField label='Animated switch' value={false} />,
    );
    timingSpy.mockClear();

    act(() => {
      rerender(<SwitchField label='Animated switch' value />);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        duration: Time.duration.medium,
        useNativeDriver: false,
      }),
    );
    expect(getLastToValue()).toBe(1);
    expectStyleColor(
      getByTestId('switch-track').props.style,
      'backgroundColor',
      palette.background.brand.default,
    );
    expectStyleColor(
      getByTestId('switch-border').props.style,
      'borderColor',
      palette.background.brand.default,
    );
    expectStyleColor(
      getByTestId('switch-thumb').props.style,
      'backgroundColor',
      palette.icon.brand.onBrand,
    );
    expect(
      getStyleProperty(getByTestId('switch-thumb').props.style, 'width'),
    ).toBe(onThumbSize);

    act(() => {
      rerender(<SwitchField label='Animated switch' value={false} />);
    });

    expect(timingSpy).toHaveBeenLastCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 0,
        duration: Time.duration.medium,
        useNativeDriver: false,
      }),
    );
    expect(getLastToValue()).toBe(0);
    expectStyleColor(
      getByTestId('switch-track').props.style,
      'backgroundColor',
      palette.background.default.secondary,
    );
    expectStyleColor(
      getByTestId('switch-border').props.style,
      'borderColor',
      palette.border.neutral.default,
    );
    expectStyleColor(
      getByTestId('switch-thumb').props.style,
      'backgroundColor',
      palette.icon.neutral.default,
    );
    expect(
      getStyleProperty(getByTestId('switch-thumb').props.style, 'width'),
    ).toBe(offThumbSize);
  });

  it('allows dragging the knob to toggle on', () => {
    const handleValueChange = jest.fn();

    render(
      <SwitchField
        label='Draggable switch'
        value={false}
        onValueChange={handleValueChange}
      />,
    );

    act(() => {
      expect(
        panResponderConfig?.onMoveShouldSetPanResponderCapture?.(
          createGestureResponderEvent(),
          createGestureState(100),
        ),
      ).toBe(true);
      panResponderConfig?.onPanResponderGrant?.(
        createGestureResponderEvent(),
        createGestureState(0),
      );
      panResponderConfig?.onPanResponderMove?.(
        createGestureResponderEvent(),
        createGestureState(100),
      );
      panResponderConfig?.onPanResponderRelease?.(
        createGestureResponderEvent(),
        createGestureState(100),
      );
    });

    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith(true);
  });

  it('updates internal state from drag when uncontrolled and ignores the synthetic press that follows', () => {
    const { timingSpy, getLastToValue } = getTimingSpyState();
    const handleValueChange = jest.fn();

    render(
      <SwitchField
        label='Uncontrolled draggable switch'
        defaultValue={false}
        onValueChange={handleValueChange}
      />,
    );

    const control = screen.getByLabelText('Uncontrolled draggable switch');
    timingSpy.mockClear();

    act(() => {
      panResponderConfig?.onPanResponderGrant?.(
        createGestureResponderEvent(),
        createGestureState(0),
      );
      panResponderConfig?.onPanResponderMove?.(
        createGestureResponderEvent(),
        createGestureState(100),
      );
      panResponderConfig?.onPanResponderRelease?.(
        createGestureResponderEvent(),
        createGestureState(100),
      );
    });

    expect(handleValueChange).toHaveBeenCalledTimes(1);
    expect(handleValueChange).toHaveBeenCalledWith(true);
    expect(getLastToValue()).toBe(1);
    expect(
      screen.getByLabelText('Uncontrolled draggable switch').props
        .accessibilityState.checked,
    ).toBe(true);

    fireEvent.press(control);

    expect(handleValueChange).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByLabelText('Uncontrolled draggable switch'));

    expect(handleValueChange).toHaveBeenCalledTimes(2);
    expect(handleValueChange).toHaveBeenLastCalledWith(false);
  });

  it('resets drag visuals to the controlled value when the parent does not rerender', () => {
    const { timingSpy, getLastToValue } = getTimingSpyState();
    const handleValueChange = jest.fn();
    const palette = Colors.dark;
    const offThumbSize =
      Size.space['600'] - 2 * Size.stroke.border - Size.space['150'];

    const { getByTestId } = render(
      <SwitchField
        label='Controlled draggable switch'
        value={false}
        onValueChange={handleValueChange}
      />,
    );

    timingSpy.mockClear();

    act(() => {
      expect(
        panResponderConfig?.onMoveShouldSetPanResponderCapture?.(
          createGestureResponderEvent(),
          createGestureState(100),
        ),
      ).toBe(true);
      panResponderConfig?.onPanResponderGrant?.(
        createGestureResponderEvent(),
        createGestureState(0),
      );
      panResponderConfig?.onPanResponderMove?.(
        createGestureResponderEvent(),
        createGestureState(100),
      );
      panResponderConfig?.onPanResponderRelease?.(
        createGestureResponderEvent(),
        createGestureState(100),
      );
    });

    expect(handleValueChange).toHaveBeenCalledWith(true);
    expect(getLastToValue()).toBe(0);
    expectStyleColor(
      getByTestId('switch-track').props.style,
      'backgroundColor',
      palette.background.default.secondary,
    );
    expectStyleColor(
      getByTestId('switch-border').props.style,
      'borderColor',
      palette.border.neutral.default,
    );
    expectStyleColor(
      getByTestId('switch-thumb').props.style,
      'backgroundColor',
      palette.icon.neutral.default,
    );
    expect(
      getStyleProperty(getByTestId('switch-thumb').props.style, 'width'),
    ).toBe(offThumbSize);
  });

  it('restores the current value when a drag is terminated', () => {
    const { timingSpy, getLastToValue } = getTimingSpyState();
    const palette = Colors.dark;
    const onThumbSize = Size.space['600'] - Size.space['150'];

    const { getByTestId } = render(
      <SwitchField label='Interrupted drag switch' value />,
    );
    timingSpy.mockClear();

    act(() => {
      panResponderConfig?.onPanResponderGrant?.(
        createGestureResponderEvent(),
        createGestureState(0),
      );
      panResponderConfig?.onPanResponderMove?.(
        createGestureResponderEvent(),
        createGestureState(-100),
      );
      panResponderConfig?.onPanResponderTerminate?.(
        createGestureResponderEvent(),
        createGestureState(0),
      );
    });

    expect(getLastToValue()).toBe(1);
    expectStyleColor(
      getByTestId('switch-track').props.style,
      'backgroundColor',
      palette.background.brand.default,
    );
    expectStyleColor(
      getByTestId('switch-border').props.style,
      'borderColor',
      palette.background.brand.default,
    );
    expectStyleColor(
      getByTestId('switch-thumb').props.style,
      'backgroundColor',
      palette.icon.brand.onBrand,
    );
    expect(
      getStyleProperty(getByTestId('switch-thumb').props.style, 'width'),
    ).toBe(onThumbSize);
    expect(
      panResponderConfig?.onPanResponderTerminationRequest?.(
        createGestureResponderEvent(),
        createGestureState(0),
      ),
    ).toBe(true);
  });

  it('keeps disabled direct handlers and drag responders inert', () => {
    const { timingSpy } = getTimingSpyState();
    const handleValueChange = jest.fn();
    const palette = Colors.dark;

    const { getByLabelText, getByTestId } = render(
      <SwitchField
        label='Disabled inert switch'
        value={false}
        disabled
        onValueChange={handleValueChange}
      />,
    );

    const control = getByLabelText('Disabled inert switch');
    timingSpy.mockClear();

    expect(
      panResponderConfig?.onMoveShouldSetPanResponder?.(
        createGestureResponderEvent(),
        createGestureState(100),
      ),
    ).toBe(false);
    expect(
      panResponderConfig?.onMoveShouldSetPanResponderCapture?.(
        createGestureResponderEvent(),
        createGestureState(100),
      ),
    ).toBe(false);

    act(() => {
      control.props.onHoverIn?.({} as any);
      control.props.onPressIn?.({} as any);
      control.props.onPress?.({} as any);
      panResponderConfig?.onPanResponderMove?.(
        createGestureResponderEvent(),
        createGestureState(100),
      );
      panResponderConfig?.onPanResponderRelease?.(
        createGestureResponderEvent(),
        createGestureState(100),
      );
      panResponderConfig?.onPanResponderTerminate?.(
        createGestureResponderEvent(),
        createGestureState(0),
      );
    });

    expect(handleValueChange).not.toHaveBeenCalled();
    expectStyleColor(
      getByTestId('switch-track').props.style,
      'backgroundColor',
      palette.background.disabled.default,
    );
    expectStyleColor(
      getByTestId('switch-thumb').props.style,
      'backgroundColor',
      palette.icon.disabled.onDisabled,
    );
    expectStyleNumber(
      getByTestId('switch-hover-fill').props.style,
      'opacity',
      0,
    );
  });

  it('does not start drag handling below the activation distance', () => {
    render(<SwitchField label='Short drag' value={false} />);

    expect(
      panResponderConfig?.onMoveShouldSetPanResponderCapture?.(
        createGestureResponderEvent(),
        createGestureState(2),
      ),
    ).toBe(false);
  });
});
