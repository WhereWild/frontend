// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { act, create } from 'react-test-renderer';
import {
  Platform,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { Colors, Size } from '@/constants/theme';
import { NavigationPill } from '../NavigationPill';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

type StyleableStyle = {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
};

type FlattenableStyle = StyleProp<ViewStyle> | StyleProp<TextStyle>;

type StyleableElement = React.ReactElement<{
  style?: StyleableStyle | (StyleableStyle | undefined)[];
  children?: React.ReactNode;
}>;

const createRenderer = (element: React.ReactElement) => {
  let renderer: ReturnType<typeof create> | undefined;
  act(() => {
    renderer = create(element);
  });
  if (!renderer) {
    throw new Error('NavigationPill renderer was not created.');
  }
  return renderer;
};

const assertStyleableElement = (element: StyleableElement | null) => {
  if (!element) {
    throw new Error('Expected element to be defined.');
  }
  return element;
};

const flattenChildren = (children: React.ReactNode): React.ReactNode[] => {
  const nodes = React.Children.toArray(children);

  return nodes.flatMap((child) => {
    if (!React.isValidElement(child)) {
      return [child];
    }

    if (child.type === React.Fragment) {
      return flattenChildren(
        (child as React.ReactElement<{ children?: React.ReactNode }>).props
          .children,
      );
    }

    return [child];
  });
};

const findNestedStyledText = (
  node: React.ReactNode,
): React.ReactElement | null => {
  if (!React.isValidElement(node)) {
    return null;
  }

  const styleProp = (node.props as { style?: unknown } | undefined)?.style;
  const styleEntries = Array.isArray(styleProp)
    ? styleProp
    : styleProp
      ? [styleProp]
      : [];
  const hasTextColor = styleEntries.some(
    (entry) => typeof entry === 'object' && entry !== null && 'color' in entry,
  );

  if (hasTextColor) {
    return node;
  }

  const children = flattenChildren(
    (node as React.ReactElement<{ children?: React.ReactNode }>).props.children,
  );
  for (const child of children) {
    const match = findNestedStyledText(child);
    if (match) {
      return match;
    }
  }

  return null;
};

describe('NavigationPill', () => {
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

  const getRenderedPillContent = (
    props: Omit<React.ComponentProps<typeof NavigationPill>, 'onPress'>,
    pressed = false,
    hovered = false,
  ) => {
    const renderer = createRenderer(
      <NavigationPill {...props} onPress={jest.fn()} />,
    );
    const updatedPressable = renderer.root.findByProps({
      accessibilityRole: 'radio',
    });

    act(() => {
      if (hovered) {
        updatedPressable.props.onHoverIn?.();
      }
      if (pressed) {
        updatedPressable.props.onPressIn?.();
      }
    });

    const nextPressable = renderer.root.findByProps({
      accessibilityRole: 'radio',
    });
    const styleProp = nextPressable.props.style;
    const rendered = nextPressable.props.children;
    const textChild = findNestedStyledText(rendered);

    return {
      content: styleProp,
      text: React.isValidElement(textChild)
        ? (textChild as StyleableElement)
        : null,
    };
  };

  const getStyleObject = (styleProp: FlattenableStyle | undefined) => {
    return StyleSheet.flatten(styleProp);
  };

  it('renders with accessibility role and label', () => {
    render(
      <NavigationPill
        id='one'
        label='One'
        isActive={false}
        onPress={jest.fn()}
        accessibilityLabel='Pill One'
      />,
    );

    const pill = screen.getByLabelText('Pill One');
    expect(pill.props.accessibilityRole).toBe('radio');
    expect(pill.props.accessibilityState?.selected).toBe(false);
  });

  it('calls onPress when inactive', () => {
    const onPress = jest.fn();
    render(
      <NavigationPill
        id='one'
        label='One'
        isActive={false}
        onPress={onPress}
      />,
    );

    fireEvent.press(screen.getByLabelText('One'));
    expect(onPress).toHaveBeenCalledWith('one');
  });

  it('calls onPress when active', () => {
    const onPress = jest.fn();
    render(
      <NavigationPill id='one' label='One' isActive={true} onPress={onPress} />,
    );

    fireEvent.press(screen.getByLabelText('One'));
    expect(onPress).toHaveBeenCalledWith('one');
  });

  it('renders default visuals when idle', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: false },
      false,
      false,
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject(content as FlattenableStyle) as {
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe('transparent');
    expect(contentStyle.borderColor).toBe(Colors.light.border.neutral.tertiary);
    expect(contentStyle.borderWidth).toBe(Size.stroke.border);
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as {
      color?: string;
    };
    expect(textStyle.color).toBe(Colors.light.text.neutral.tertiary);
  });

  it('renders active visuals when selected', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: true },
      false,
      false,
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject(content as FlattenableStyle) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(
      Colors.light.background.brand.default,
    );
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as {
      color?: string;
    };
    expect(textStyle.color).toBe(Colors.light.text.brand.onBrand);
  });

  it('renders highlighted visuals with a thicker dashed border', () => {
    const { content } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: false, isHighlighted: true },
      false,
      false,
    );
    expect(content).not.toBeNull();

    const contentStyle = getStyleObject(content as FlattenableStyle) as {
      borderColor?: string;
      borderWidth?: number;
      borderStyle?: string;
    };

    expect(contentStyle.borderColor).toBe('#F59E0B');
    expect(contentStyle.borderWidth).toBe(3);
    expect(contentStyle.borderStyle).toBe('dashed');
  });

  it('keeps the dashed highlight border when highlighted and active', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: true, isHighlighted: true },
      false,
      false,
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject(content as FlattenableStyle) as {
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      borderStyle?: string;
    };

    expect(contentStyle.backgroundColor).toBe(
      Colors.light.background.brand.default,
    );
    expect(contentStyle.borderColor).toBe('#F59E0B');
    expect(contentStyle.borderWidth).toBe(3);
    expect(contentStyle.borderStyle).toBe('dashed');
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as {
      color?: string;
    };
    expect(textStyle.color).toBe(Colors.light.text.brand.onBrand);
  });

  it('keeps active visuals on hover', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: true },
      false,
      true,
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject(content as FlattenableStyle) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(
      Colors.light.background.brand.default,
    );
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as {
      color?: string;
    };
    expect(textStyle.color).toBe(Colors.light.text.brand.onBrand);
  });

  it('keeps active visuals on press', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: true },
      true,
      false,
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject(content as FlattenableStyle) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(
      Colors.light.background.brand.default,
    );
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as {
      color?: string;
    };
    expect(textStyle.color).toBe(Colors.light.text.brand.onBrand);
  });

  it('renders hover visuals when inactive hover', () => {
    setPlatformOS('web');
    Object.assign(global, {
      window: {
        innerWidth: 1280,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: false },
      false,
      true,
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject(content as FlattenableStyle) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(
      Colors.light.background.neutral.tertiaryHover,
    );
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as {
      color?: string;
    };
    expect(textStyle.color).toBe(Colors.light.text.neutral.onNeutralTertiary);
  });

  it('renders pressed visuals when inactive pressed', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: false },
      true,
      false,
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject(content as FlattenableStyle) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(
      Colors.light.background.neutral.tertiaryPressed,
    );
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as {
      color?: string;
    };
    expect(textStyle.color).toBe(Colors.light.text.neutral.onNeutralTertiary);
  });

  it('keeps stable content wrappers across rerenders', () => {
    const renderer = createRenderer(
      <NavigationPill
        id='one'
        label='One'
        isActive={false}
        onPress={jest.fn()}
      />,
    );

    const getStableWrapperCount = () =>
      renderer.root.findAll(
        (node) =>
          typeof node.type === 'string' && node.props?.collapsable === false,
      ).length;

    const initialWrapperCount = getStableWrapperCount();

    act(() => {
      renderer.update(
        <NavigationPill
          id='one'
          label='One'
          isActive={true}
          onPress={jest.fn()}
        />,
      );
    });

    expect(getStableWrapperCount()).toBe(initialWrapperCount);

    act(() => {
      renderer.update(
        <NavigationPill
          id='one'
          label='One'
          isActive={true}
          icon={<></>}
          onPress={jest.fn()}
        />,
      );
    });

    expect(getStableWrapperCount()).toBe(initialWrapperCount);
  });
});
