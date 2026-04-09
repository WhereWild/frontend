import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Colors, Size } from '@/constants/theme';
import { Tab, __TAB_TESTING__ } from '../Tab';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('Tab', () => {
  const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(
    Platform,
    'OS',
  );

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

  const getStyleObject = (styleProp: unknown) => {
    return StyleSheet.flatten(styleProp as any);
  };

  const findStyledElement = (
    node: React.ReactNode,
    predicate: (style: Record<string, unknown>) => boolean,
  ): React.ReactElement | null => {
    if (!React.isValidElement(node)) {
      if (Array.isArray(node)) {
        for (const child of node) {
          const found = findStyledElement(child, predicate);
          if (found) {
            return found;
          }
        }
      }
      return null;
    }

    const typedNode = node as React.ReactElement<{
      style?: unknown;
      children?: React.ReactNode;
    }>;
    const flattenedStyle = StyleSheet.flatten(typedNode.props.style as any) as
      | Record<string, unknown>
      | undefined;

    if (flattenedStyle && predicate(flattenedStyle)) {
      return typedNode;
    }

    return findStyledElement(typedNode.props.children ?? null, predicate);
  };

  const getRenderedVisualState = (
    props: Omit<React.ComponentProps<typeof Tab>, 'onPress'>,
    pressed = false,
    hovered = false,
  ) => {
    let renderer: ReactTestRenderer | undefined;

    act(() => {
      renderer = create(<Tab {...props} onPress={jest.fn()} />);
    });

    if (renderer === undefined) {
      throw new Error('Tab renderer was not created.');
    }

    const pressable = renderer.root.findByProps({ accessibilityRole: 'tab' });

    act(() => {
      if (hovered) {
        pressable.props.onHoverIn?.();
      }
      if (pressed) {
        pressable.props.onPressIn?.();
      }
    });

    const updatedPressable = renderer.root.findByProps({
      accessibilityRole: 'tab',
    });
    const containerStyle = getStyleObject(updatedPressable.props.style) as {
      backgroundColor?: string;
      borderColor?: string;
      borderBottomWidth?: number;
    };
    const rendered = updatedPressable.props.children;
    const pill = findStyledElement(
      rendered,
      (style) =>
        style.backgroundColor !== undefined && style.borderRadius !== undefined,
    );
    const text = findStyledElement(
      rendered,
      (style) => style.color !== undefined,
    );
    const separator = findStyledElement(
      rendered,
      (style) =>
        style.width === Size.stroke.border &&
        style.height === Size.space['400'],
    );

    return {
      containerStyle,
      pillStyle: getStyleObject(
        (pill as React.ReactElement<any>)?.props.style,
      ) as { backgroundColor?: string },
      textStyle: getStyleObject(
        (text as React.ReactElement<any>)?.props.style,
      ) as { color?: string },
      separatorStyle: getStyleObject(
        (separator as React.ReactElement<any>)?.props.style,
      ) as { right?: number },
    };
  };

  it('renders with accessibility role and label', () => {
    render(
      <Tab
        id='one'
        label='One'
        isActive={false}
        onPress={jest.fn()}
        accessibilityLabel='Tab One'
      />,
    );

    const tab = screen.getByLabelText('Tab One');
    expect(tab.props.accessibilityRole).toBe('tab');
    expect(tab.props.accessibilityState?.selected).toBe(false);
  });

  it('calls onPress when inactive', () => {
    const onPress = jest.fn();
    render(<Tab id='one' label='One' isActive={false} onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('One'));
    expect(onPress).toHaveBeenCalledWith('one');
  });

  it('does not call onPress when active', () => {
    const onPress = jest.fn();
    render(<Tab id='one' label='One' isActive={true} onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('One'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('applies inactive styles to container, pill, and text', () => {
    const { containerStyle, pillStyle, textStyle } = getRenderedVisualState(
      { id: 'one', label: 'One', isActive: false, testID: 'tab-one' },
      false,
      false,
    );
    const state = __TAB_TESTING__.getTabState('light', false, false, false);

    expect(containerStyle.backgroundColor).toBe(state.outerBackgroundColor);
    expect(containerStyle.borderColor).toBe(state.borderColor);
    expect(containerStyle.borderBottomWidth).toBe(state.borderBottomWidth);
    expect(pillStyle.backgroundColor).toBe(state.pillBackgroundColor);
    expect(textStyle.color).toBe(state.textColor);
  });

  it('applies active styles to container, pill, and text', () => {
    const { containerStyle, pillStyle, textStyle } = getRenderedVisualState(
      { id: 'one', label: 'One', isActive: true, testID: 'tab-one' },
      false,
      false,
    );
    const state = __TAB_TESTING__.getTabState('light', true, false, false);

    expect(containerStyle.backgroundColor).toBe(state.outerBackgroundColor);
    expect(containerStyle.borderColor).toBe(state.borderColor);
    expect(containerStyle.borderBottomWidth).toBe(state.borderBottomWidth);
    expect(pillStyle.backgroundColor).toBe(state.pillBackgroundColor);
    expect(textStyle.color).toBe(state.textColor);
  });

  it('returns inactive state colors when idle', () => {
    const state = __TAB_TESTING__.getTabState('light', false, false, false);
    expect(state.outerBackgroundColor).toBe('transparent');
    expect(state.pillBackgroundColor).toBe('transparent');
    expect(state.borderColor).toBe(Colors.light.border.neutral.default);
    expect(state.textVariant).toBe('singleLineBody');
    expect(state.textColor).toBe(Colors.light.text.neutral.default);
    expect(state.borderBottomWidth).toBe(Size.stroke.border);
  });

  it('returns active state colors when selected', () => {
    const state = __TAB_TESTING__.getTabState('light', true, false, false);
    expect(state.outerBackgroundColor).toBe(
      Colors.light.background.neutral.default,
    );
    expect(state.pillBackgroundColor).toBe('transparent');
    expect(state.textVariant).toBe('singleLineBody');
    expect(state.textColor).toBe(Colors.light.text.neutral.onNeutral);
    expect(state.borderBottomWidth).toBe(Size.stroke.border);
  });

  it('returns hover state colors for inactive hover', () => {
    const state = __TAB_TESTING__.getTabState('dark', false, false, true);
    expect(state.pillBackgroundColor).toBe(
      Colors.dark.background.neutral.hover,
    );
    expect(state.textVariant).toBe('singleLineBody');
    expect(state.textColor).toBe(Colors.dark.text.neutral.onNeutral);
  });

  it('returns pressed state colors for inactive pressed', () => {
    const state = __TAB_TESTING__.getTabState('dark', false, true, false);
    expect(state.pillBackgroundColor).toBe(
      Colors.dark.background.neutral.pressed,
    );
    expect(state.textVariant).toBe('singleLineBody');
    expect(state.textColor).toBe(Colors.dark.text.neutral.onNeutral);
  });

  it('ignores hover visuals when native hover is disabled', () => {
    const { containerStyle, pillStyle, textStyle } = getRenderedVisualState(
      {
        id: 'one',
        label: 'One',
        isActive: false,
        disableNativeHoverVisuals: true,
        testID: 'tab-one',
      },
      false,
      true,
    );
    const state = __TAB_TESTING__.getTabState('light', false, false, false);

    expect(containerStyle.backgroundColor).toBe(state.outerBackgroundColor);
    expect(containerStyle.borderColor).toBe(state.borderColor);
    expect(pillStyle.backgroundColor).toBe(state.pillBackgroundColor);
    expect(textStyle.color).toBe(state.textColor);
  });

  it('renders pressed visuals on native tabs', () => {
    const { containerStyle, pillStyle, textStyle } = getRenderedVisualState(
      { id: 'one', label: 'One', isActive: false, testID: 'tab-one' },
      true,
      false,
    );
    const pressedState = __TAB_TESTING__.getTabState(
      'light',
      false,
      true,
      false,
    );

    expect(containerStyle.backgroundColor).toBe(
      pressedState.outerBackgroundColor,
    );
    expect(containerStyle.borderColor).toBe(pressedState.borderColor);
    expect(containerStyle.borderBottomWidth).toBe(
      pressedState.borderBottomWidth,
    );
    expect(pillStyle.backgroundColor).toBe(pressedState.pillBackgroundColor);
    expect(textStyle.color).toBe(pressedState.textColor);
  });

  it('positions native separators at the outer tab edge', () => {
    const { separatorStyle } = getRenderedVisualState(
      {
        id: 'one',
        label: 'One',
        isActive: false,
        separatorColor: Colors.light.border.neutral.default,
        separatorHidden: false,
        testID: 'tab-one',
      },
      false,
      false,
    );

    expect(separatorStyle.right).toBe(-Size.space['200']);
  });

  it('renders hover visuals on native tabs when hover suppression is not requested', () => {
    const { containerStyle, pillStyle, textStyle } = getRenderedVisualState(
      { id: 'one', label: 'One', isActive: false, testID: 'tab-one' },
      false,
      true,
    );
    const hoveredState = __TAB_TESTING__.getTabState(
      'light',
      false,
      false,
      true,
    );

    expect(containerStyle.backgroundColor).toBe(
      hoveredState.outerBackgroundColor,
    );
    expect(containerStyle.borderColor).toBe(hoveredState.borderColor);
    expect(containerStyle.borderBottomWidth).toBe(
      hoveredState.borderBottomWidth,
    );
    expect(pillStyle.backgroundColor).toBe(hoveredState.pillBackgroundColor);
    expect(textStyle.color).toBe(hoveredState.textColor);
  });

  it('suppresses native hover visuals without suppressing pressed visuals', () => {
    const hoveredVisualState = getRenderedVisualState(
      {
        id: 'one',
        label: 'One',
        isActive: false,
        disableNativeHoverVisuals: true,
        testID: 'tab-one',
      },
      false,
      true,
    );
    const pressedVisualState = getRenderedVisualState(
      {
        id: 'one',
        label: 'One',
        isActive: false,
        disableNativeHoverVisuals: true,
        testID: 'tab-one',
      },
      true,
      false,
    );
    const idleState = __TAB_TESTING__.getTabState('light', false, false, false);
    const pressedState = __TAB_TESTING__.getTabState(
      'light',
      false,
      true,
      false,
    );

    expect(hoveredVisualState.pillStyle.backgroundColor).toBe(
      idleState.pillBackgroundColor,
    );
    expect(hoveredVisualState.textStyle.color).toBe(idleState.textColor);
    expect(pressedVisualState.pillStyle.backgroundColor).toBe(
      pressedState.pillBackgroundColor,
    );
    expect(pressedVisualState.textStyle.color).toBe(pressedState.textColor);
  });

  it('uses the web tab path when running on web', () => {
    setPlatformOS('web');
    const onPress = jest.fn();
    const onKeyDown = jest.fn();
    Object.assign(global, {
      window: {
        innerWidth: 1280,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });

    render(
      <Tab
        id='one'
        label='One'
        isActive={false}
        onPress={onPress}
        onKeyDown={onKeyDown}
        focusable
        tabIndex={0}
        testID='tab-one'
      />,
    );

    const tab = screen.getByTestId('tab-one');
    const hoveredState = __TAB_TESTING__.getTabState(
      'light',
      false,
      false,
      true,
    );

    const { containerStyle, pillStyle, textStyle } = getRenderedVisualState(
      {
        id: 'one',
        label: 'One',
        isActive: false,
        onKeyDown,
        focusable: true,
        tabIndex: 0,
        testID: 'tab-one',
      },
      false,
      true,
    );

    expect(containerStyle.backgroundColor).toBe(
      hoveredState.outerBackgroundColor,
    );
    fireEvent.press(tab);
    expect(onPress).toHaveBeenCalledWith('one');
    expect(pillStyle.backgroundColor).toBe(hoveredState.pillBackgroundColor);
    expect(textStyle.color).toBe(hoveredState.textColor);
  });

  it('uses the tab entrypoint file to delegate native rendering without web-only props', () => {
    jest.isolateModules(() => {
      const RN =
        jest.requireActual<typeof import('react-native')>('react-native');
      const descriptor = Object.getOwnPropertyDescriptor(RN.Platform, 'OS');
      const nativeSpy = jest.fn<null, [Record<string, unknown>]>(() => null);
      const webSpy = jest.fn<null, [Record<string, unknown>]>(() => null);

      jest.doMock('../Tab.native.tsx', () => ({ Tab: nativeSpy }));
      jest.doMock('../Tab.web.tsx', () => ({ Tab: webSpy }));

      Object.defineProperty(RN.Platform, 'OS', {
        configurable: true,
        get: () => 'ios',
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Tab: EntryTab } = require('../Tab.tsx');

        act(() => {
          create(
            <EntryTab
              id='native-entry'
              label='Native Entry'
              isActive={false}
              onPress={jest.fn()}
              onKeyDown={jest.fn()}
              focusable={true}
              tabIndex={0}
            />,
          );
        });

        expect(webSpy).not.toHaveBeenCalled();
        expect(nativeSpy).toHaveBeenCalledTimes(1);
        const nativeCall = nativeSpy.mock.calls[0];
        if (!nativeCall) {
          throw new Error('Expected native tab delegate call.');
        }
        const forwardedProps = nativeCall[0];
        expect(forwardedProps).toMatchObject({
          id: 'native-entry',
          label: 'Native Entry',
          isActive: false,
        });
        expect(forwardedProps).not.toHaveProperty('onKeyDown');
        expect(forwardedProps).not.toHaveProperty('focusable');
        expect(forwardedProps).not.toHaveProperty('tabIndex');
      } finally {
        jest.dontMock('../Tab.native.tsx');
        jest.dontMock('../Tab.web.tsx');
        if (descriptor) {
          Object.defineProperty(RN.Platform, 'OS', descriptor);
        }
      }
    });
  });

  it('uses the tab entrypoint file to delegate web rendering with keyboard props intact', () => {
    jest.isolateModules(() => {
      const RN =
        jest.requireActual<typeof import('react-native')>('react-native');
      const descriptor = Object.getOwnPropertyDescriptor(RN.Platform, 'OS');
      const nativeSpy = jest.fn<null, [Record<string, unknown>]>(() => null);
      const webSpy = jest.fn<null, [Record<string, unknown>]>(() => null);
      const onKeyDown = jest.fn();

      jest.doMock('../Tab.native.tsx', () => ({ Tab: nativeSpy }));
      jest.doMock('../Tab.web.tsx', () => ({ Tab: webSpy }));

      Object.defineProperty(RN.Platform, 'OS', {
        configurable: true,
        get: () => 'web',
      });

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Tab: EntryTab } = require('../Tab.tsx');

        act(() => {
          create(
            <EntryTab
              id='web-entry'
              label='Web Entry'
              isActive={false}
              onPress={jest.fn()}
              onKeyDown={onKeyDown}
              focusable={true}
              tabIndex={0}
            />,
          );
        });

        expect(nativeSpy).not.toHaveBeenCalled();
        expect(webSpy).toHaveBeenCalledTimes(1);
        const webCall = webSpy.mock.calls[0];
        if (!webCall) {
          throw new Error('Expected web tab delegate call.');
        }
        const forwardedProps = webCall[0];
        expect(forwardedProps).toMatchObject({
          id: 'web-entry',
          label: 'Web Entry',
          isActive: false,
          onKeyDown,
          focusable: true,
          tabIndex: 0,
        });
      } finally {
        jest.dontMock('../Tab.native.tsx');
        jest.dontMock('../Tab.web.tsx');
        if (descriptor) {
          Object.defineProperty(RN.Platform, 'OS', descriptor);
        }
      }
    });
  });

  it('keeps the web implementation from firing onPress for the active tab', () => {
    setPlatformOS('web');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Tab: WebTab } = require('../Tab.web');
    const onPress = jest.fn();

    render(
      <WebTab
        id='web-active'
        label='Web Active'
        isActive={true}
        onPress={onPress}
        onKeyDown={jest.fn()}
        focusable={true}
        tabIndex={0}
      />,
    );

    fireEvent.press(screen.getByLabelText('Web Active'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
