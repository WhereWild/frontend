import React from 'react';
import { Platform, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import renderer, { act as rendererAct } from 'react-test-renderer';
import type { ReactTestInstance } from 'react-test-renderer';
import { SelectFieldView } from '../SelectFieldView';
import type { SelectFieldViewProps } from '../useSelectFieldController';

type PressableStyleFunction = (state: { pressed: boolean; hovered: boolean }) => unknown[];

// Returns the last matching style property to mirror React Native style precedence.
const getStyleProperty = (styles: unknown[], propertyName: string): string | undefined => {
  for (let index = styles.length - 1; index >= 0; index -= 1) {
    const item = styles[index];
    if (typeof item === 'object' && item !== null && propertyName in item) {
      const value = (item as Record<string, unknown>)[propertyName];
      if (typeof value === 'string') {
        return value;
      }
    }
  }
  return undefined;
};

const findByAccessibilityLabel = (
  tree: renderer.ReactTestRenderer | null,
  label: string,
): ReactTestInstance => {
  if (!tree) {
    throw new Error(`Expected test renderer tree for ${label}.`);
  }
  const nodes = tree.root.findAll((item: ReactTestInstance) => item.props?.accessibilityLabel === label);
  const node = nodes[0];
  if (!node) {
    const availableLabels = tree.root
      .findAll((item: ReactTestInstance) => typeof item.props?.accessibilityLabel === 'string')
      .map((item) => item.props.accessibilityLabel);
    throw new Error(`Expected element with accessibility label: ${label}. Available labels: ${availableLabels.join(', ') || 'none'}.`);
  }
  return node;
};

const findHostNodesByTestId = (
  tree: renderer.ReactTestRenderer | null,
  testID: string,
): ReactTestInstance[] => {
  if (!tree) {
    throw new Error(`Expected test renderer tree for ${testID}.`);
  }

  return tree.root.findAll(
    (item: ReactTestInstance) => item.props?.testID === testID && typeof item.type === 'string',
  );
};

const createTestTree = (props: SelectFieldViewProps): {
  tree: renderer.ReactTestRenderer;
  cleanup: () => void;
} => {
  let tree: renderer.ReactTestRenderer | null = null;
  rendererAct(() => {
    tree = renderer.create(<SelectFieldView {...props} />);
  });
  if (!tree) {
    throw new Error('Expected test renderer tree for SelectFieldView.');
  }
  const renderedTree = tree as renderer.ReactTestRenderer;
  const cleanup = () => {
    rendererAct(() => {
      renderedTree.unmount();
    });
  };
  return { tree: renderedTree, cleanup };
};

const createOption = (overrides: Partial<SelectFieldViewProps['options'][number]> = {}) => ({
  key: 'hello',
  label: 'Hello World',
  isSelected: false,
  isHighlighted: false,
  onPress: jest.fn(),
  onPressIn: jest.fn(),
  onPressOut: jest.fn(),
  onTouchStart: jest.fn(),
  onTouchEnd: jest.fn(),
  onLayout: jest.fn(),
  accessibilityLabel: 'Select Hello World',
  pressableProps: null,
  ...overrides,
});

const createProps = (overrides: Partial<SelectFieldViewProps> = {}): SelectFieldViewProps => {
  const option = createOption();
  return {
    label: 'Label',
    description: 'Description',
    errorMessage: 'Error',
    labelColor: 'red',
    descriptionColor: 'blue',
    errorColor: 'orange',
    isOpen: false,
    allowSearch: true,
    showPlaceholder: true,
    placeholder: 'Pick one',
    valueText: 'Pick one',
    placeholderColor: 'gray',
    valueColor: 'black',
    fieldBackgroundDefault: 'white',
    fieldBackgroundHover: 'lightgray',
    fieldBackgroundPressed: 'gray',
    fieldStyleOverrides: [],
    fieldPressableProps: { accessibilityLabel: 'Select field', onPress: jest.fn() },
    fieldPressableRef: React.createRef(),
    fieldWrapperRef: React.createRef(),
    onFieldWrapperLayout: jest.fn(),
    dropdownPosition: { top: 100, left: 20, width: 220, height: 40 },
    onDismiss: jest.fn(),
    inputRef: React.createRef(),
    inputProps: { placeholder: 'Pick one', accessibilityLabel: 'Select input' },
    iconButtonProps: {
      accessibilityLabel: 'Toggle select',
      disabled: false,
      icon: <View />,
      onPress: jest.fn(),
    },
    options: [option],
    optionsContainerStyleOverrides: [],
    optionActiveBackgroundColor: 'green',
    optionFocusedBackgroundColor: 'yellow',
    optionHoverBackgroundColor: 'cyan',
    optionPressedBackgroundColor: 'orange',
    optionActiveTextColor: 'white',
    optionDefaultTextColor: 'black',
    optionFocusedRingColor: 'purple',
    scrollViewRef: React.createRef(),
    dropShadowStyle: {},
    containerStyle: undefined,
    ...overrides,
  };
};

describe('SelectFieldView', () => {
  it('renders label, description, error, and placeholder when closed', () => {
    const props = createProps({ isOpen: false });
    render(<SelectFieldView {...props} />);

    expect(screen.getByText('Label')).toBeTruthy();
    expect(screen.getByText('Description')).toBeTruthy();
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText('Pick one')).toBeTruthy();
  });

  it('does not mount the portal while closed', () => {
    const props = createProps({ isOpen: false });
    render(<SelectFieldView {...props} />);

    expect(screen.queryByLabelText('Close dropdown')).toBeNull();
    expect(screen.queryByLabelText('Label options')).toBeNull();
  });

  it('renders portal input and option handlers when open with search', () => {
    const props = createProps({ isOpen: true, allowSearch: true });
    render(<SelectFieldView {...props} />);

    expect(screen.getByPlaceholderText('Pick one')).toBeTruthy();

    const option = screen.getByLabelText('Select Hello World');
    fireEvent(option, 'touchStart');
    fireEvent(option, 'touchEnd');
    fireEvent(option, 'pressIn');
    fireEvent(option, 'pressOut');
    fireEvent.press(option);

    expect(props.options[0].onTouchStart).toHaveBeenCalled();
    expect(props.options[0].onTouchEnd).toHaveBeenCalled();
    expect(props.options[0].onPressIn).toHaveBeenCalled();
    expect(props.options[0].onPressOut).toHaveBeenCalled();
    expect(props.options[0].onPress).toHaveBeenCalled();
  });

  it('renders a hidden input when open without search', () => {
    const props = createProps({
      isOpen: true,
      allowSearch: false,
      inputProps: { accessibilityLabel: 'Hidden input' },
    });
    const { tree, cleanup } = createTestTree(props);

    try {
      expect(findHostNodesByTestId(tree, 'select-field-portal-input')).toHaveLength(1);
      expect(findByAccessibilityLabel(tree, 'Select Hello World')).toBeTruthy();
    } finally {
      cleanup();
    }
  });

  it('uses placeholder fallback for portal accessibility label', () => {
    const props = createProps({
      label: undefined,
      placeholder: 'Choose one',
      valueText: 'Choose one',
      isOpen: true,
    });
    render(<SelectFieldView {...props} />);

    expect(screen.getByLabelText('Choose one options')).toBeTruthy();
  });

  it('uses default portal accessibility label when no label or placeholder', () => {
    const props = createProps({
      label: undefined,
      placeholder: '',
      valueText: '',
      isOpen: true,
    });
    render(<SelectFieldView {...props} />);

    expect(screen.getByLabelText('Select options')).toBeTruthy();
  });

  it('renders a hidden input when open with search but no dropdown position', () => {
    const props = createProps({
      isOpen: true,
      allowSearch: true,
      dropdownPosition: null,
      inputProps: { accessibilityLabel: 'Hidden input' },
    });
    const { tree, cleanup } = createTestTree(props);

    try {
      expect(findHostNodesByTestId(tree, 'select-field-portal-input')).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  it('keeps portal host slots mounted across open dropdown rerenders', () => {
    const initialProps = createProps({
      isOpen: true,
      allowSearch: true,
      dropdownPosition: { top: 100, left: 20, width: 220, height: 40 },
    });
    const { tree, cleanup } = createTestTree(initialProps);

    try {
      expect(findHostNodesByTestId(tree, 'select-field-portal-backdrop-slot')).toHaveLength(1);
      expect(findHostNodesByTestId(tree, 'select-field-portal-input-slot')).toHaveLength(1);
      expect(findHostNodesByTestId(tree, 'select-field-portal-icon-slot')).toHaveLength(1);
      expect(findHostNodesByTestId(tree, 'select-field-portal-options-slot')).toHaveLength(1);

      rendererAct(() => {
        tree.update(
          <SelectFieldView
            {...createProps({
              isOpen: true,
              allowSearch: false,
              dropdownPosition: null,
              inputProps: { accessibilityLabel: 'Hidden input' },
            })}
          />,
        );
      });

      expect(findHostNodesByTestId(tree, 'select-field-portal-backdrop-slot')).toHaveLength(1);
      expect(findHostNodesByTestId(tree, 'select-field-portal-input-slot')).toHaveLength(1);
      expect(findHostNodesByTestId(tree, 'select-field-portal-icon-slot')).toHaveLength(1);
      expect(findHostNodesByTestId(tree, 'select-field-portal-options-slot')).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  it('applies field and option style branches', () => {
    const highlightedOption = createOption({
      key: 'highlighted',
      label: 'Highlighted',
      accessibilityLabel: 'Select Highlighted',
      isHighlighted: true,
    });
    const hoverOption = createOption({
      key: 'hovered',
      label: 'Hovered',
      accessibilityLabel: 'Select Hovered',
    });
    const selectedOption = createOption({
      key: 'selected',
      label: 'Selected',
      accessibilityLabel: 'Select Selected',
      isSelected: true,
    });
    const props = createProps({
      isOpen: true,
      options: [highlightedOption, hoverOption, selectedOption],
    });
    const { tree, cleanup } = createTestTree(props);
    const field = findByAccessibilityLabel(tree, 'Select field');
    const fieldStyleFn = field.props.style as PressableStyleFunction;
    const pressedFieldStyle = fieldStyleFn({ pressed: true, hovered: false });
    const hoveredFieldStyle = fieldStyleFn({ pressed: false, hovered: true });
    const pressedFieldBackground = getStyleProperty(pressedFieldStyle, 'backgroundColor');
    const hoveredFieldBackground = getStyleProperty(hoveredFieldStyle, 'backgroundColor');

    expect(pressedFieldBackground).toBe(props.fieldBackgroundPressed);
    expect(hoveredFieldBackground).toBe(props.fieldBackgroundHover);

    const highlighted = findByAccessibilityLabel(tree, 'Select Highlighted');
    const highlightedStyleFn = highlighted.props.style as PressableStyleFunction;
    const highlightedStyle = highlightedStyleFn({ pressed: false, hovered: false });
    const highlightedBackground = getStyleProperty(highlightedStyle, 'backgroundColor');
    expect(highlightedBackground).toBe(props.optionFocusedBackgroundColor);

    const selected = findByAccessibilityLabel(tree, 'Select Selected');
    const selectedStyleFn = selected.props.style as PressableStyleFunction;
    const selectedStyle = selectedStyleFn({ pressed: false, hovered: false });
    const selectedBackground = getStyleProperty(selectedStyle, 'backgroundColor');
    expect(selectedBackground).toBe(props.optionActiveBackgroundColor);

    const hovered = findByAccessibilityLabel(tree, 'Select Hovered');
    const hoveredStyleFn = hovered.props.style as PressableStyleFunction;
    const hoveredStyle = hoveredStyleFn({ pressed: false, hovered: true });
    const hoveredBackground = getStyleProperty(hoveredStyle, 'backgroundColor');
    expect(hoveredBackground).toBe(props.optionHoverBackgroundColor);

    const pressedStyle = hoveredStyleFn({ pressed: true, hovered: false });
    const pressedBackground = getStyleProperty(pressedStyle, 'backgroundColor');
    expect(pressedBackground).toBe(props.optionPressedBackgroundColor);

    cleanup();
  });

  it('adds Safari outline styles for highlighted options', () => {
    const highlightedOption = createOption({
      key: 'highlighted-web',
      label: 'Highlighted Web',
      accessibilityLabel: 'Select Highlighted Web',
      isHighlighted: true,
    });
    const props = createProps({
      isOpen: true,
      options: [highlightedOption],
    });
    const { tree, cleanup } = createTestTree(props);
    try {
      const option = findByAccessibilityLabel(tree, 'Select Highlighted Web');
      const optionStyleFn = option.props.style as PressableStyleFunction;
      const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        configurable: true,
        value: { userAgent: 'Mozilla/5.0 AppleWebKit/605.1.15 Safari/605.1.15' },
      });

      try {
        const optionStyle = optionStyleFn({ pressed: false, hovered: false });
        const outlineStyle = getStyleProperty(optionStyle, 'outlineStyle');
        const outlineColor = getStyleProperty(optionStyle, 'outlineColor');

        expect(outlineStyle).toBe('solid');
        expect(outlineColor).toBe(props.optionFocusedRingColor);
      } finally {
        if (originalNavigator !== undefined) {
          Object.defineProperty(global, 'navigator', { configurable: true, value: originalNavigator });
        } else {
          Object.defineProperty(global, 'navigator', { configurable: true, value: undefined });
        }
        if (originalDescriptor) {
          Object.defineProperty(Platform, 'OS', originalDescriptor);
        }
      }
    } finally {
      cleanup();
    }
  });

  it('uses auto outline on non-Safari web', () => {
    const highlightedOption = createOption({
      key: 'highlighted-web-non-safari',
      label: 'Highlighted Web Non Safari',
      accessibilityLabel: 'Select Highlighted Web Non Safari',
      isHighlighted: true,
    });
    const props = createProps({
      isOpen: true,
      options: [highlightedOption],
    });
    const { tree, cleanup } = createTestTree(props);
    try {
      const option = findByAccessibilityLabel(tree, 'Select Highlighted Web Non Safari');
      const optionStyleFn = option.props.style as PressableStyleFunction;
      const originalDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
      const originalNavigator = global.navigator;
      Object.defineProperty(global, 'navigator', {
        configurable: true,
        value: { userAgent: 'Mozilla/5.0 AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
      });

      try {
        const optionStyle = optionStyleFn({ pressed: false, hovered: false });
        const outlineStyle = getStyleProperty(optionStyle, 'outlineStyle');

        expect(outlineStyle).toBe('auto');
      } finally {
        if (originalNavigator !== undefined) {
          Object.defineProperty(global, 'navigator', { configurable: true, value: originalNavigator });
        } else {
          Object.defineProperty(global, 'navigator', { configurable: true, value: undefined });
        }
        if (originalDescriptor) {
          Object.defineProperty(Platform, 'OS', originalDescriptor);
        }
      }
    } finally {
      cleanup();
    }
  });
});
