// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Colors } from '@/constants/theme';
import { act, render } from '@testing-library/react-native';
import React from 'react';
import {
  Platform,
  StyleSheet,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import type { SearchInputViewProps } from '../SearchInputView';
import {
  useSearchInputController,
  type UseSearchInputControllerArgs,
} from '../useSearchInputController';

const ControllerHarness = React.forwardRef<
  SearchInputViewProps,
  Partial<UseSearchInputControllerArgs>
>((props, ref) => {
  const viewProps = useSearchInputController({
    variant: props.variant ?? 'tertiary',
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    placeholder: props.placeholder ?? 'Search',
    disabled: props.disabled ?? false,
    containerStyle: props.containerStyle,
    inputStyle: props.inputStyle,
    onQueryChange: props.onQueryChange,
    onCharacterAdd: props.onCharacterAdd,
    onSubmitSearch: props.onSubmitSearch,
    onClear: props.onClear,
    textInputProps: props.textInputProps ?? {},
    characterReader: props.characterReader,
  });
  React.useImperativeHandle(ref, () => viewProps, [viewProps]);
  return null;
});
ControllerHarness.displayName = 'ControllerHarness';

describe('useSearchInputController', () => {
  const flattenContainer = (controller?: SearchInputViewProps | null) => {
    const containerStyle: StyleProp<ViewStyle> =
      controller?.containerStyle ?? [];
    const normalizedStyle = Array.isArray(containerStyle)
      ? containerStyle
      : [containerStyle];
    return StyleSheet.flatten(normalizedStyle) ?? {};
  };

  type FocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
  const createFocusEvent = (): FocusEvent => {
    const hostStub = {} as FocusEvent['target'];
    return {
      nativeEvent: { target: 0 },
      bubbles: false,
      cancelable: false,
      currentTarget: hostStub,
      defaultPrevented: false,
      eventPhase: 0,
      isDefaultPrevented: () => false,
      isPropagationStopped: () => false,
      isTrusted: true,
      preventDefault: () => {},
      stopPropagation: () => {},
      persist: () => {},
      target: hostStub,
      timeStamp: Date.now(),
      type: 'focus',
    } as FocusEvent;
  };

  it('resets interaction states after disabling and re-enabling', () => {
    const controllerRef = React.createRef<SearchInputViewProps>();
    const { rerender } = render(
      <ControllerHarness
        ref={controllerRef}
        defaultValue='seed'
        disabled={false}
      />,
    );

    expect(controllerRef.current).toBeTruthy();
    const palette = Colors.dark;
    const getBackgroundColor = () =>
      flattenContainer(controllerRef.current).backgroundColor;

    expect(getBackgroundColor()).toBe(palette.background.default.tertiary);

    act(() => {
      controllerRef.current?.containerHandlers.onHoverIn?.();
      controllerRef.current?.containerHandlers.onPressIn?.();
    });

    expect(getBackgroundColor()).toBe(
      palette.background.default.tertiaryPressed,
    );

    rerender(
      <ControllerHarness ref={controllerRef} defaultValue='seed' disabled />,
    );
    expect(getBackgroundColor()).toBe(palette.background.disabled.default);

    rerender(
      <ControllerHarness
        ref={controllerRef}
        defaultValue='seed'
        disabled={false}
      />,
    );
    expect(getBackgroundColor()).toBe(palette.background.default.tertiary);
  });

  it('uses hover colors when only hovering', () => {
    const controllerRef = React.createRef<SearchInputViewProps>();
    render(
      <ControllerHarness
        ref={controllerRef}
        defaultValue='seed'
        disabled={false}
      />,
    );

    const palette = Colors.dark;
    expect(flattenContainer(controllerRef.current).backgroundColor).toBe(
      palette.background.default.tertiary,
    );

    act(() => {
      controllerRef.current?.containerHandlers.onHoverIn?.();
    });

    expect(flattenContainer(controllerRef.current).backgroundColor).toBe(
      palette.background.default.tertiaryHover,
    );

    act(() => {
      controllerRef.current?.containerHandlers.onHoverOut?.();
    });

    expect(flattenContainer(controllerRef.current).backgroundColor).toBe(
      palette.background.default.tertiary,
    );
  });

  it('uses secondary background tokens when variant is secondary', () => {
    const controllerRef = React.createRef<SearchInputViewProps>();
    render(
      <ControllerHarness
        ref={controllerRef}
        defaultValue='seed'
        disabled={false}
        variant='secondary'
      />,
    );

    const palette = Colors.dark;
    expect(flattenContainer(controllerRef.current).backgroundColor).toBe(
      palette.background.default.secondary,
    );

    act(() => {
      controllerRef.current?.containerHandlers.onHoverIn?.();
    });

    expect(flattenContainer(controllerRef.current).backgroundColor).toBe(
      palette.background.default.secondaryHover,
    );

    act(() => {
      controllerRef.current?.containerHandlers.onPressIn?.();
    });

    expect(flattenContainer(controllerRef.current).backgroundColor).toBe(
      palette.background.default.secondaryPressed,
    );
  });

  it('applies native outline styles on web focus transitions', () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });

    try {
      const controllerRef = React.createRef<SearchInputViewProps>();
      render(
        <ControllerHarness
          ref={controllerRef}
          defaultValue='seed'
          disabled={false}
        />,
      );

      expect(controllerRef.current).toBeTruthy();
      const getOutlineStyle = () =>
        (StyleSheet.flatten(controllerRef.current?.containerStyle ?? []) ?? {})
          .outlineStyle;

      expect(getOutlineStyle()).toBe('none');

      act(() => {
        controllerRef.current?.inputProps.onFocus?.(createFocusEvent());
      });
      expect(getOutlineStyle()).toBe('auto');

      act(() => {
        controllerRef.current?.inputProps.onBlur?.(createFocusEvent());
      });
      expect(getOutlineStyle()).toBe('none');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Platform, 'OS', originalDescriptor);
      }
    }
  });

  it('reports appended characters when they can be read', () => {
    const onCharacterAdd = jest.fn();
    const controllerRef = React.createRef<SearchInputViewProps>();
    render(
      <ControllerHarness
        ref={controllerRef}
        defaultValue=''
        disabled={false}
        onCharacterAdd={onCharacterAdd}
      />,
    );

    act(() => {
      controllerRef.current?.inputProps.onChangeText?.('l');
    });
    expect(onCharacterAdd).toHaveBeenLastCalledWith('l', 'l');

    act(() => {
      controllerRef.current?.inputProps.onChangeText?.('lynx');
    });
    expect(onCharacterAdd).toHaveBeenLastCalledWith('x', 'lynx');
    expect(onCharacterAdd).toHaveBeenCalledTimes(2);
  });

  it('skips character add notifications when the last glyph cannot be derived', () => {
    const onCharacterAdd = jest.fn();
    const controllerRef = React.createRef<SearchInputViewProps>();
    render(
      <ControllerHarness
        ref={controllerRef}
        defaultValue=''
        disabled={false}
        onCharacterAdd={onCharacterAdd}
        characterReader={() => undefined}
      />,
    );

    act(() => {
      controllerRef.current?.inputProps.onChangeText?.('lynx');
    });

    expect(onCharacterAdd).not.toHaveBeenCalled();
  });
});
