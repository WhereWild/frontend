import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Platform, type LayoutChangeEvent } from 'react-native';
import { Size } from '@/constants/theme';
import type { SelectFieldProps, SelectFieldViewProps } from '../useSelectFieldController';
import { useSelectFieldController } from '../useSelectFieldController';

const OPTIONS = [
  { label: 'Hello World', value: 'hello' },
  { label: 'Option 2', value: 'option-2' },
  { label: 'Option 3', value: 'option-3' },
  { label: 'Option 4', value: 'option-4' },
  { label: 'Option 5', value: 'option-5' },
];

const ControllerHarness = React.forwardRef<SelectFieldViewProps, Partial<SelectFieldProps>>(
  (props, ref) => {
    const viewProps = useSelectFieldController({
      label: props.label,
      description: props.description,
      errorMessage: props.errorMessage,
      placeholder: props.placeholder ?? 'Value',
      disabled: props.disabled ?? false,
      allowSearch: props.allowSearch ?? true,
      options: props.options ?? OPTIONS,
      value: props.value ?? '',
      onValueChange: props.onValueChange,
      onOpenChange: props.onOpenChange,
      style: props.style,
    });

    React.useImperativeHandle(ref, () => viewProps, [viewProps]);
    return null;
  },
);
ControllerHarness.displayName = 'ControllerHarness';

const createLayoutEvent = (y = 12, height = 24): LayoutChangeEvent =>
  ({
    nativeEvent: {
      layout: {
        x: 0,
        y,
        width: 100,
        height,
      },
    },
  } as LayoutChangeEvent);

const createPressEvent = () => undefined as unknown as Parameters<
  NonNullable<SelectFieldViewProps['fieldPressableProps']['onPress']>
>[0];

describe('useSelectFieldController', () => {
  it('measures dropdown position when measureInWindow is available', () => {
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} />);

    act(() => {
      if (controllerRef.current) {
        controllerRef.current.fieldWrapperRef.current = {
          measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => {
            cb(10, 20, 120, 40);
          },
        } as unknown as SelectFieldViewProps['fieldWrapperRef']['current'];
        controllerRef.current.onFieldWrapperLayout();
      }
    });

    expect(controllerRef.current?.dropdownPosition).toEqual({
      left: 10,
      width: 120,
      height: 40,
      top: 20 + 40 + Size.space['100'],
    });
  });

  it('ignores blur while an option press is in progress', () => {
    jest.useFakeTimers();
    const onOpenChange = jest.fn();
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} onOpenChange={onOpenChange} />);

    act(() => {
      controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
    });

    act(() => {
      controllerRef.current?.options[0].onPressIn();
      controllerRef.current?.inputProps.onBlur?.(undefined as never);
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    jest.useRealTimers();
  });

  it('clears pending blur timeout when an option is selected', () => {
    jest.useFakeTimers();
    const onOpenChange = jest.fn();
    const onValueChange = jest.fn();
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(
      <ControllerHarness
        ref={controllerRef}
        onOpenChange={onOpenChange}
        onValueChange={onValueChange}
      />,
    );

    act(() => {
      controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
      controllerRef.current?.inputProps.onBlur?.(undefined as never);
    });

    act(() => {
      controllerRef.current?.options[0].onPress();
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(onValueChange).toHaveBeenCalledWith('hello');
    expect(onOpenChange).toHaveBeenCalledWith(false);

    jest.useRealTimers();
  });

  it('scrolls to the highlighted option when layout is known', () => {
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} />);

    act(() => {
      if (controllerRef.current) {
        controllerRef.current.scrollViewRef.current = {
          scrollTo: jest.fn(),
        } as unknown as SelectFieldViewProps['scrollViewRef']['current'];
        controllerRef.current.options[0].onLayout(createLayoutEvent(48, 20));
      }
    });

    act(() => {
      controllerRef.current?.inputProps.onKeyPress?.({
        nativeEvent: { key: 'ArrowDown' },
      } as never);
    });

    expect(controllerRef.current?.scrollViewRef.current?.scrollTo).toHaveBeenCalled();
  });

  it('selects the second option after two ArrowDown presses', async () => {
    const onValueChange = jest.fn();
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} onValueChange={onValueChange} />);

    await act(async () => {
      controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
    });
    await act(async () => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'ArrowDown' } } as never);
    });
    await act(async () => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'ArrowDown' } } as never);
    });
    await act(async () => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'Enter' } } as never);
    });

    expect(onValueChange).toHaveBeenCalledWith('option-2');
  });

  it('wraps to the last option when ArrowUp is pressed after a highlight exists', async () => {
    const onValueChange = jest.fn();
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} onValueChange={onValueChange} />);

    await act(async () => {
      controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
    });
    await act(async () => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'ArrowDown' } } as never);
    });
    await act(async () => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'ArrowUp' } } as never);
    });
    await act(async () => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'Enter' } } as never);
    });

    expect(onValueChange).toHaveBeenCalledWith('option-5');
  });

  it('no-ops when options are empty', () => {
    const onValueChange = jest.fn();
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(
      <ControllerHarness
        ref={controllerRef}
        options={[]}
        onValueChange={onValueChange}
      />,
    );

    act(() => {
      controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'ArrowDown' } } as never);
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'Enter' } } as never);
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('applies the web keydown handler to open the list', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      const onOpenChange = jest.fn();
      const controllerRef = React.createRef<SelectFieldViewProps>();
      render(<ControllerHarness ref={controllerRef} onOpenChange={onOpenChange} />);

      act(() => {
        (controllerRef.current?.fieldPressableProps as { onKeyDown?: (event: { key: string; preventDefault?: () => void; stopPropagation?: () => void }) => void } | undefined)
          ?.onKeyDown?.({
            key: 'Enter',
            preventDefault: jest.fn(),
            stopPropagation: jest.fn(),
          });
      });

      expect(onOpenChange).toHaveBeenCalledWith(true);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });

  it('does not select when disabled', () => {
    const onValueChange = jest.fn();
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(
      <ControllerHarness
        ref={controllerRef}
        disabled
        onValueChange={onValueChange}
      />,
    );

    act(() => {
      controllerRef.current?.options[0].onPress();
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });
});
