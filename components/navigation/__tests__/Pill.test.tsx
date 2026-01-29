import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { act, create } from 'react-test-renderer';
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

describe('NavigationPill', () => {
  const getRenderedPillContent = (
    props: Omit<React.ComponentProps<typeof NavigationPill>, 'onPress'>,
    pressed = false,
    hovered = false
  ) => {
    const renderer = createRenderer(
      <NavigationPill
        {...props}
        onPress={jest.fn()}
      />
    );
    const pressable = renderer.root.findByProps({ accessibilityRole: 'radio' });
    const childrenProp = pressable.props.children;
    const rendered = typeof childrenProp === 'function'
      ? childrenProp({ pressed, hovered })
      : childrenProp;
    const renderedElement = Array.isArray(rendered) ? rendered[0] : rendered;
    if (!React.isValidElement(renderedElement)) {
      return { content: null, text: null };
    }
    const renderedWithProps = renderedElement as StyleableElement;
    const textChild = React.Children.toArray(renderedWithProps.props.children)[0];
    return {
      content: renderedWithProps,
      text: React.isValidElement(textChild) ? (textChild as StyleableElement) : null,
    };
  };

  const getStyleObject = (styleProp: unknown) => {
    if (Array.isArray(styleProp)) {
      return styleProp[styleProp.length - 1];
    }
    return styleProp;
  };

  it('renders with accessibility role and label', () => {
    render(
      <NavigationPill
        id="one"
        label="One"
        isActive={false}
        onPress={jest.fn()}
        accessibilityLabel="Pill One"
      />
    );

    const pill = screen.getByLabelText('Pill One');
    expect(pill.props.accessibilityRole).toBe('radio');
    expect(pill.props.accessibilityState?.selected).toBe(false);
  });

  it('calls onPress when inactive', () => {
    const onPress = jest.fn();
    render(
      <NavigationPill
        id="one"
        label="One"
        isActive={false}
        onPress={onPress}
      />
    );

    fireEvent.press(screen.getByLabelText('One'));
    expect(onPress).toHaveBeenCalledWith('one');
  });

  it('does not call onPress when active', () => {
    const onPress = jest.fn();
    render(
      <NavigationPill
        id="one"
        label="One"
        isActive={true}
        onPress={onPress}
      />
    );

    fireEvent.press(screen.getByLabelText('One'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders default visuals when idle', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: false },
      false,
      false
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject((content as StyleableElement).props.style) as {
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe('transparent');
    expect(contentStyle.borderColor).toBe(Colors.light.border.neutral.tertiary);
    expect(contentStyle.borderWidth).toBe(Size.stroke.border);
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as { color?: string };
    expect(textStyle.color).toBe(
      Colors.light.text.neutral.tertiary
    );
  });

  it('renders active visuals when selected', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: true },
      false,
      false
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject((content as StyleableElement).props.style) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(Colors.light.background.brand.default);
    expect(contentStyle.borderWidth).toBe(0);
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as { color?: string };
    expect(textStyle.color).toBe(
      Colors.light.text.brand.onBrand
    );
  });

  it('keeps active visuals on hover', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: true },
      false,
      true
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject((content as StyleableElement).props.style) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(Colors.light.background.brand.default);
    expect(contentStyle.borderWidth).toBe(0);
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as { color?: string };
    expect(textStyle.color).toBe(
      Colors.light.text.brand.onBrand
    );
  });

  it('keeps active visuals on press', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: true },
      true,
      false
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject((content as StyleableElement).props.style) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(Colors.light.background.brand.default);
    expect(contentStyle.borderWidth).toBe(0);
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as { color?: string };
    expect(textStyle.color).toBe(
      Colors.light.text.brand.onBrand
    );
  });

  it('renders hover visuals when inactive hover', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: false },
      false,
      true
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject((content as StyleableElement).props.style) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(Colors.light.background.neutral.tertiaryHover);
    expect(contentStyle.borderWidth).toBe(0);
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as { color?: string };
    expect(textStyle.color).toBe(
      Colors.light.text.neutral.onNeutralTertiary
    );
  });

  it('renders pressed visuals when inactive pressed', () => {
    const { content, text } = getRenderedPillContent(
      { id: 'one', label: 'One', isActive: false },
      true,
      false
    );
    expect(content).not.toBeNull();
    expect(text).not.toBeNull();

    const contentStyle = getStyleObject((content as StyleableElement).props.style) as {
      backgroundColor?: string;
      borderWidth?: number;
    };

    expect(contentStyle.backgroundColor).toBe(Colors.light.background.neutral.tertiaryPressed);
    expect(contentStyle.borderWidth).toBe(0);
    const textElement = assertStyleableElement(text);
    const textStyle = getStyleObject(textElement.props.style) as { color?: string };
    expect(textStyle.color).toBe(
      Colors.light.text.neutral.onNeutralTertiary
    );
  });
});