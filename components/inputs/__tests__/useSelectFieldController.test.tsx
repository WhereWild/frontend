import React from 'react';
import { act, render } from '@testing-library/react-native';
import {
  Keyboard,
  Platform,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Size } from '@/constants/theme';
import type { SelectFieldProps } from '../SelectField';
import type { SelectFieldViewProps } from '../useSelectFieldController';
import { useSelectFieldController } from '../useSelectFieldController';
type WebKeyDownEvent = {
  key: string;
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

type WebKeyDownHandler = (event: WebKeyDownEvent) => void;

const getWebKeyDown = (value: unknown): WebKeyDownHandler | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const candidate = (value as { onKeyDown?: WebKeyDownHandler }).onKeyDown;
  return typeof candidate === 'function' ? candidate : undefined;
};

type OutlineStyle = { outlineStyle?: string };

const isOutlineStyle = (value: unknown): value is OutlineStyle =>
  value !== null
  && typeof value === 'object'
  && 'outlineStyle' in value;

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

const createScrollEvent = (y = 0): NativeSyntheticEvent<NativeScrollEvent> =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentInset: { top: 0, right: 0, bottom: 0, left: 0 },
      contentSize: { width: 0, height: 0 },
      layoutMeasurement: { width: 0, height: 0 },
      zoomScale: 1,
    },
  } as NativeSyntheticEvent<NativeScrollEvent>);

const createPressEvent = () => undefined as unknown as Parameters<
  NonNullable<SelectFieldViewProps['fieldPressableProps']['onPress']>
>[0];

describe('useSelectFieldController', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

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

  it('scrolls down when the highlighted option is below the visible area', () => {
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} />);

    const scrollTo = jest.fn();
    const optionTop = 140;
    const optionHeight = 20;
    const viewportHeight = 100;
    act(() => {
      if (controllerRef.current) {
        controllerRef.current.scrollViewRef.current = {
          scrollTo,
        } as unknown as SelectFieldViewProps['scrollViewRef']['current'];
        controllerRef.current.scrollViewProps?.onLayout?.(createLayoutEvent(0, viewportHeight));
        controllerRef.current.scrollViewProps?.onScroll?.(createScrollEvent(0));
        controllerRef.current.options[0].onLayout(createLayoutEvent(optionTop, optionHeight));
      }
    });

    act(() => {
      controllerRef.current?.inputProps.onKeyPress?.({
        nativeEvent: { key: 'ArrowDown' },
      } as never);
    });

    const expectedY = Math.max(0, optionTop + optionHeight - viewportHeight + Size.space['400']);
    expect(scrollTo).toHaveBeenCalledWith({ y: expectedY, animated: true });
  });

  it('scrolls down when the highlighted option hits the buffer boundary', () => {
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} />);

    const scrollTo = jest.fn();
    const viewportHeight = 100;
    const optionHeight = 20;
    const optionTop = viewportHeight - Size.space['600'];

    act(() => {
      if (controllerRef.current) {
        controllerRef.current.scrollViewRef.current = {
          scrollTo,
        } as unknown as SelectFieldViewProps['scrollViewRef']['current'];
        controllerRef.current.scrollViewProps?.onLayout?.(createLayoutEvent(0, viewportHeight));
        controllerRef.current.scrollViewProps?.onScroll?.(createScrollEvent(0));
        controllerRef.current.options[0].onLayout(createLayoutEvent(optionTop, optionHeight));
      }
    });

    act(() => {
      controllerRef.current?.inputProps.onKeyPress?.({
        nativeEvent: { key: 'ArrowDown' },
      } as never);
    });

    const expectedY = Math.max(0, optionTop + optionHeight - viewportHeight + Size.space['400']);
    expect(scrollTo).toHaveBeenCalledWith({ y: expectedY, animated: true });
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

  it('selects the only option on Enter when no highlight exists', () => {
    const onValueChange = jest.fn();
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(
      <ControllerHarness
        ref={controllerRef}
        options={[{ label: 'Only Option', value: 'only' }]}
        onValueChange={onValueChange}
      />,
    );

    act(() => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'Enter' } } as never);
    });

    expect(onValueChange).toHaveBeenCalledWith('only');
  });

  it('does not select on Enter when multiple options exist and no highlight exists', () => {
    const onValueChange = jest.fn();
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} onValueChange={onValueChange} />);

    act(() => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'Enter' } } as never);
    });

    expect(onValueChange).not.toHaveBeenCalled();
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
        getWebKeyDown(controllerRef.current?.fieldPressableProps)?.({
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

  it('does not open when disabled on press', () => {
    const onOpenChange = jest.fn();
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(
      <ControllerHarness
        ref={controllerRef}
        disabled
        onOpenChange={onOpenChange}
      />,
    );

    act(() => {
      controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('filters options and highlights the first match on text change', () => {
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} />);

    act(() => {
      controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
    });

    act(() => {
      controllerRef.current?.inputProps.onChangeText?.('Option 4');
    });

    const optionLabels = controllerRef.current?.options.map((option) => option.label) ?? [];
    expect(optionLabels).toEqual(['Option 4']);
    expect(controllerRef.current?.options[0].isHighlighted).toBe(true);
  });

  it('uses the raw value label when it does not exist in options', () => {
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} options={[]} value="missing" />);

    expect(controllerRef.current?.valueText).toBe('missing');
    expect(controllerRef.current?.showPlaceholder).toBe(false);
  });

  it('does not open on Enter keydown for the input on web', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      const onOpenChange = jest.fn();
      const controllerRef = React.createRef<SelectFieldViewProps>();
      render(<ControllerHarness ref={controllerRef} onOpenChange={onOpenChange} />);

      act(() => {
        getWebKeyDown(controllerRef.current?.inputProps)?.({
          key: 'Enter',
          preventDefault: jest.fn(),
          stopPropagation: jest.fn(),
        });
      });

      expect(onOpenChange).not.toHaveBeenCalledWith(true);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });

  it('exposes a web focus ring style after focus', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      const controllerRef = React.createRef<SelectFieldViewProps>();
      render(<ControllerHarness ref={controllerRef} />);

      act(() => {
        controllerRef.current?.fieldPressableProps.onFocus?.(undefined as never);
      });

      const focusRingStyle = controllerRef.current?.fieldStyleOverrides.find(
        (style) => isOutlineStyle(style) && String(style.outlineStyle) === 'auto',
      );

      expect(focusRingStyle?.outlineStyle).toBe('auto');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });

  it('keeps the list open on web blur when an option press is in progress', () => {
    jest.useFakeTimers();
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      const onOpenChange = jest.fn();
      const controllerRef = React.createRef<SelectFieldViewProps>();
      render(<ControllerHarness ref={controllerRef} onOpenChange={onOpenChange} />);

      act(() => {
        controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
        controllerRef.current?.options[0].onPressIn();
        controllerRef.current?.inputProps.onBlur?.(undefined as never);
      });

      act(() => {
        jest.runAllTimers();
      });

      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    } finally {
      jest.useRealTimers();
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });

  it('closes on web blur and restores focus when no press is active', () => {
    jest.useFakeTimers();
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    const originalRaf = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };

    try {
      const onOpenChange = jest.fn();
      const controllerRef = React.createRef<SelectFieldViewProps>();
      render(<ControllerHarness ref={controllerRef} onOpenChange={onOpenChange} />);

      const focusSpy = jest.fn();
      if (controllerRef.current) {
        controllerRef.current.fieldPressableRef.current = {
          focus: focusSpy,
        } as unknown as SelectFieldViewProps['fieldPressableRef']['current'];
      }

      act(() => {
        controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
        controllerRef.current?.inputProps.onBlur?.(undefined as never);
      });

      act(() => {
        jest.runAllTimers();
      });

      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(focusSpy).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      global.requestAnimationFrame = originalRaf;
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });

  it('focuses the input when the field is pressed while open', () => {
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} />);

    const focusSpy = jest.fn();
    if (controllerRef.current) {
      controllerRef.current.inputRef.current = {
        focus: focusSpy,
      } as unknown as SelectFieldViewProps['inputRef']['current'];
    }

    act(() => {
      controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
    });

    act(() => {
      controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('scrolls up when the highlighted option is above the visible area', () => {
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} />);

    const scrollTo = jest.fn();
    const optionTop = 40;
    const optionHeight = 20;
    const viewportHeight = 80;
    const scrollOffset = 120;
    if (controllerRef.current) {
      controllerRef.current.scrollViewRef.current = {
        scrollTo,
      } as unknown as SelectFieldViewProps['scrollViewRef']['current'];
      controllerRef.current.scrollViewProps?.onLayout?.(createLayoutEvent(0, viewportHeight));
      controllerRef.current.scrollViewProps?.onScroll?.(createScrollEvent(scrollOffset));
    }

    act(() => {
      controllerRef.current?.options[0].onLayout(createLayoutEvent(optionTop, optionHeight));
    });

    act(() => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'ArrowDown' } } as never);
    });

    expect(scrollTo).toHaveBeenCalledWith({ y: Math.max(0, optionTop), animated: true });
  });

  it('does not scroll when the highlighted option is already visible', () => {
    const controllerRef = React.createRef<SelectFieldViewProps>();
    render(<ControllerHarness ref={controllerRef} />);

    const scrollTo = jest.fn();
    const optionTop = 40;
    const optionHeight = 20;
    const viewportHeight = 140;
    if (controllerRef.current) {
      controllerRef.current.scrollViewRef.current = {
        scrollTo,
      } as unknown as SelectFieldViewProps['scrollViewRef']['current'];
      controllerRef.current.scrollViewProps?.onLayout?.(createLayoutEvent(0, viewportHeight));
      controllerRef.current.scrollViewProps?.onScroll?.(createScrollEvent(0));
    }

    act(() => {
      controllerRef.current?.options[0].onLayout(createLayoutEvent(optionTop, optionHeight));
    });

    act(() => {
      controllerRef.current?.inputProps.onKeyPress?.({ nativeEvent: { key: 'ArrowDown' } } as never);
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not close on native blur (keyboard dismissal)', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    try {
      const onOpenChange = jest.fn();
      const controllerRef = React.createRef<SelectFieldViewProps>();
      render(<ControllerHarness ref={controllerRef} onOpenChange={onOpenChange} />);

      act(() => {
        controllerRef.current?.fieldPressableProps.onPress?.(createPressEvent());
      });

      act(() => {
        controllerRef.current?.inputProps.onBlur?.(undefined as never);
      });

      expect(onOpenChange).toHaveBeenCalledWith(true);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });

  it('dismisses the keyboard on native when selecting an option', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });

    const dismissSpy = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);

    try {
      const onValueChange = jest.fn();
      const controllerRef = React.createRef<SelectFieldViewProps>();
      render(<ControllerHarness ref={controllerRef} onValueChange={onValueChange} />);

      act(() => {
        controllerRef.current?.options[0].onPress();
      });

      expect(onValueChange).toHaveBeenCalledWith('hello');
      expect(dismissSpy).toHaveBeenCalled();
    } finally {
      dismissSpy.mockRestore();
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });

  it('restores focus to the field on web after selection', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    const originalRaf = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };

    try {
      const controllerRef = React.createRef<SelectFieldViewProps>();
      render(<ControllerHarness ref={controllerRef} />);

      const focusSpy = jest.fn();
      if (controllerRef.current) {
        controllerRef.current.fieldPressableRef.current = {
          focus: focusSpy,
        } as unknown as SelectFieldViewProps['fieldPressableRef']['current'];
      }

      act(() => {
        controllerRef.current?.options[0].onPress();
      });

      expect(focusSpy).toHaveBeenCalled();
    } finally {
      global.requestAnimationFrame = originalRaf;
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });
});
