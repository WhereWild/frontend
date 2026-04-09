import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import renderer, { act as rendererAct } from 'react-test-renderer';
import { Animated } from 'react-native';
import { Colors, Time } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { RadioField } from '../RadioField';

const mockedUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

const getStyleProperty = (
  styles: unknown[],
  propertyName: string,
): string | undefined => {
  for (let index = styles.length - 1; index >= 0; index -= 1) {
    const style = styles[index];
    if (typeof style === 'object' && style !== null && propertyName in style) {
      const value = (style as Record<string, unknown>)[propertyName];
      if (typeof value === 'string') {
        return value;
      }
    }
  }
  return undefined;
};

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

describe('RadioField', () => {
  beforeEach(() => {
    mockedUseColorScheme.mockReturnValue('dark');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses fallback accessibility label when no label is provided', () => {
    render(<RadioField checked={false} />);

    expect(screen.getByLabelText('Radio field')).toBeTruthy();
    expect(screen.queryByText('Label')).toBeNull();
  });

  it('uses explicit accessibilityLabel when provided', () => {
    render(
      <RadioField
        label='Label'
        accessibilityLabel='Custom radio'
        checked={false}
      />,
    );

    expect(screen.getByLabelText('Custom radio')).toBeTruthy();
  });

  it('renders label and description when provided', () => {
    render(<RadioField label='Label' description='Description' checked />);

    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
  });

  it('selects to true when pressed from unchecked controlled state', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioField
        label='Radio'
        checked={false}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByLabelText('Radio'));
    expect(handleValueChange).toHaveBeenCalledWith(true);
  });

  it('does not toggle when pressing the label text', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioField
        label='Radio'
        checked={false}
        onValueChange={handleValueChange}
      />,
    );

    fireEvent.press(screen.getByText('Radio'));
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('does not emit when already checked', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioField label='Radio' checked onValueChange={handleValueChange} />,
    );

    fireEvent.press(screen.getByLabelText('Radio'));
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('does not emit when disabled', () => {
    const handleValueChange = jest.fn();
    render(
      <RadioField
        label='Disabled radio'
        checked={false}
        disabled
        onValueChange={handleValueChange}
      />,
    );

    const control = screen.getByLabelText('Disabled radio');
    fireEvent.press(control);

    expect(control.props.accessibilityState.disabled).toBe(true);
    expect(handleValueChange).not.toHaveBeenCalled();
  });

  it('manages checked state internally when uncontrolled', () => {
    render(<RadioField label='Uncontrolled radio' defaultChecked={false} />);

    const control = screen.getByLabelText('Uncontrolled radio');
    expect(control.props.accessibilityState.selected).toBe(false);

    fireEvent.press(control);

    expect(
      screen.getByLabelText('Uncontrolled radio').props.accessibilityState
        .selected,
    ).toBe(true);
  });

  it('applies selected and unselected indicator border colors', () => {
    const palette = Colors.dark;
    let selectedRenderer: renderer.ReactTestRenderer;
    let unselectedRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      selectedRenderer = renderer.create(
        <RadioField label='Selected' checked />,
      );
      unselectedRenderer = renderer.create(
        <RadioField label='Unselected' checked={false} />,
      );
    });

    const selectedNode = selectedRenderer!.root.findByProps({
      accessibilityLabel: 'Selected',
    });
    const selectedChild = selectedNode.props.children({
      pressed: false,
      hovered: false,
    });
    const selectedStyle = selectedChild.props.style as unknown[];

    const unselectedNode = unselectedRenderer!.root.findByProps({
      accessibilityLabel: 'Unselected',
    });
    const unselectedChild = unselectedNode.props.children({
      pressed: false,
      hovered: false,
    });
    const unselectedStyle = unselectedChild.props.style as unknown[];

    expect(getStyleProperty(selectedStyle, 'borderColor')).toBe(
      palette.background.brand.default,
    );
    expect(getStyleProperty(unselectedStyle, 'borderColor')).toBe(
      palette.border.default.default,
    );
  });

  it('applies hover and pressed styles for checked indicator', () => {
    const palette = Colors.dark;
    let testRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      testRenderer = renderer.create(
        <RadioField label='Checked state' checked />,
      );
    });

    const radioNode = testRenderer!.root.findByProps({
      accessibilityLabel: 'Checked state',
    });
    const hoveredChild = radioNode.props.children({
      pressed: false,
      hovered: true,
    });
    const hoveredStyle = hoveredChild.props.style as unknown[];

    const pressedChild = radioNode.props.children({
      pressed: true,
      hovered: false,
    });
    const pressedStyle = pressedChild.props.style as unknown[];

    expect(getStyleProperty(hoveredStyle, 'backgroundColor')).toBe(
      palette.background.brand.hover,
    );
    expect(getStyleProperty(pressedStyle, 'backgroundColor')).toBe(
      palette.background.brand.default,
    );
  });

  it('applies hover and pressed styles for unchecked indicator', () => {
    const palette = Colors.dark;
    let testRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      testRenderer = renderer.create(
        <RadioField label='Unchecked state' checked={false} />,
      );
    });

    const radioNode = testRenderer!.root.findByProps({
      accessibilityLabel: 'Unchecked state',
    });
    const hoveredChild = radioNode.props.children({
      pressed: false,
      hovered: true,
    });
    const hoveredStyle = hoveredChild.props.style as unknown[];

    const pressedChild = radioNode.props.children({
      pressed: true,
      hovered: false,
    });
    const pressedStyle = pressedChild.props.style as unknown[];

    expect(getStyleProperty(hoveredStyle, 'backgroundColor')).toBe(
      palette.background.default.hover,
    );
    expect(getStyleProperty(pressedStyle, 'backgroundColor')).toBe(
      palette.background.default.pressed,
    );
  });

  it('exposes radio accessibility role and selected state', () => {
    render(<RadioField label='A11y radio' checked />);

    const radio = screen.getByLabelText('A11y radio');
    expect(radio.props.accessibilityRole).toBe('radio');
    expect(radio.props.accessibilityState.selected).toBe(true);
  });

  it('uses light palette tokens when color scheme is light', () => {
    mockedUseColorScheme.mockReturnValue('light');
    const palette = Colors.light;
    let testRenderer: renderer.ReactTestRenderer;

    rendererAct(() => {
      testRenderer = renderer.create(
        <RadioField label='Light mode' checked={false} />,
      );
    });

    const radioNode = testRenderer!.root.findByProps({
      accessibilityLabel: 'Light mode',
    });
    const defaultChild = radioNode.props.children({
      pressed: false,
      hovered: false,
    });
    const defaultStyle = defaultChild.props.style as unknown[];

    expect(getStyleProperty(defaultStyle, 'backgroundColor')).toBe(
      palette.background.default.default,
    );
    expect(getStyleProperty(defaultStyle, 'borderColor')).toBe(
      palette.border.default.default,
    );
  });

  it('animates indicator opacity on hover in and out using short timing', () => {
    const { timingSpy, getLastToValue } = createTimingToValueMock();

    let testRenderer: renderer.ReactTestRenderer;
    rendererAct(() => {
      testRenderer = renderer.create(
        <RadioField label='Animated radio' checked={false} />,
      );
    });
    const control = testRenderer!.root.findByProps({
      accessibilityLabel: 'Animated radio',
    });
    timingSpy.mockClear();

    act(() => {
      control.props.onHoverIn?.({} as any);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 0.92,
        duration: Time.duration.short,
        useNativeDriver: true,
      }),
    );
    expect(getLastToValue()).toBe(0.92);

    act(() => {
      control.props.onHoverOut?.({} as any);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 1,
        duration: Time.duration.short,
        useNativeDriver: true,
      }),
    );
    expect(getLastToValue()).toBe(1);
  });

  it('animates dot opacity when checked state changes', () => {
    const { timingSpy, getLastToValue } = createTimingToValueMock();

    const { rerender } = render(
      <RadioField label='Animated state' checked={false} />,
    );
    timingSpy.mockClear();

    act(() => {
      rerender(<RadioField label='Animated state' checked />);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 1,
        duration: Time.duration.short,
        useNativeDriver: true,
      }),
    );
    expect(getLastToValue()).toBe(1);
  });

  it('fades dot out when checked becomes unchecked', () => {
    const { timingSpy, getLastToValue } = createTimingToValueMock();

    const { rerender } = render(<RadioField label='Fade out state' checked />);
    timingSpy.mockClear();

    act(() => {
      rerender(<RadioField label='Fade out state' checked={false} />);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 0,
        duration: Time.duration.short,
        useNativeDriver: true,
      }),
    );
    expect(getLastToValue()).toBe(0);
  });

  it('keeps pressed interaction immediate without hover fade animation', () => {
    const startMock = jest.fn();
    const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: startMock,
    } as any);
    const handleValueChange = jest.fn();

    render(
      <RadioField
        label='Pressed immediate'
        checked={false}
        onValueChange={handleValueChange}
      />,
    );
    const control = screen.getByLabelText('Pressed immediate');
    timingSpy.mockClear();
    startMock.mockClear();

    fireEvent.press(control);

    expect(handleValueChange).toHaveBeenCalledWith(true);
    expect(timingSpy).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();
  });

  it('does not start additional hover fade animation when pressing while hovered', () => {
    const startMock = jest.fn();
    const timingSpy = jest.spyOn(Animated, 'timing').mockReturnValue({
      start: startMock,
    } as any);
    const handleValueChange = jest.fn();

    let testRenderer: renderer.ReactTestRenderer;
    rendererAct(() => {
      testRenderer = renderer.create(
        <RadioField
          label='Hover and press'
          checked={false}
          onValueChange={handleValueChange}
        />,
      );
    });

    const control = testRenderer!.root.findByProps({
      accessibilityLabel: 'Hover and press',
    });
    timingSpy.mockClear();
    startMock.mockClear();

    act(() => {
      control.props.onHoverIn?.({} as any);
    });

    expect(timingSpy).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        toValue: 0.92,
        duration: Time.duration.short,
        useNativeDriver: true,
      }),
    );

    timingSpy.mockClear();
    startMock.mockClear();

    act(() => {
      control.props.onPress?.();
    });

    expect(handleValueChange).toHaveBeenCalledWith(true);
    expect(timingSpy).not.toHaveBeenCalled();
    expect(startMock).not.toHaveBeenCalled();
  });
});
