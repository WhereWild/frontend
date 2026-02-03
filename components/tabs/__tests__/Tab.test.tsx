import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Colors, Size } from '@/constants/theme';
import { Tab, __TAB_TESTING__ } from '../Tab';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('Tab', () => {
  const getRenderedPill = (
    tab: ReturnType<typeof screen.getByTestId>,
    pressed = false,
    hovered = false
  ): React.ReactElement | null => {
    const childrenProp = tab.props.children;
    const rendered = typeof childrenProp === 'function'
      ? childrenProp({ pressed, hovered })
      : childrenProp;
    const renderedElement = Array.isArray(rendered) ? rendered[0] : rendered;
    if (!renderedElement || !React.isValidElement(renderedElement)) {
      return null;
    }
    const renderedWithProps = renderedElement as React.ReactElement<any>;
    const children = React.Children.toArray(renderedWithProps.props.children);
    const pill = children[0];
    return React.isValidElement(pill) ? (pill as React.ReactElement<any>) : null;
  };

  const getRenderedText = (pill: React.ReactElement | null): React.ReactElement | null => {
    if (!pill || !React.isValidElement(pill)) {
      return null;
    }
    const pillWithProps = pill as React.ReactElement<any>;
    const pillChildren = React.Children.toArray(pillWithProps.props.children);
    const text = pillChildren[0];
    return React.isValidElement(text) ? (text as React.ReactElement<any>) : null;
  };

  const getStyleObject = (styleProp: unknown) => {
    if (Array.isArray(styleProp)) {
      return styleProp[1];
    }
    return styleProp;
  };

  const getContainerStyle = (
    tab: ReturnType<typeof screen.getByLabelText>,
    pressed = false,
    hovered = false
  ) => {
    const styleProp = tab.props.style;
    const resolved = typeof styleProp === 'function'
      ? styleProp({ pressed, hovered })
      : styleProp;
    if (Array.isArray(resolved)) {
      return resolved[1];
    }
    return resolved;
  };

  it('renders with accessibility role and label', () => {
    render(
      <Tab
        id="one"
        label="One"
        isActive={false}
        onPress={jest.fn()}
        accessibilityLabel="Tab One"
      />
    );

    const tab = screen.getByLabelText('Tab One');
    expect(tab.props.accessibilityRole).toBe('tab');
    expect(tab.props.accessibilityState?.selected).toBe(false);
  });

  it('calls onPress when inactive', () => {
    const onPress = jest.fn();
    render(
      <Tab
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
      <Tab
        id="one"
        label="One"
        isActive={true}
        onPress={onPress}
      />
    );

    fireEvent.press(screen.getByLabelText('One'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('applies inactive styles to container, pill, and text', () => {
    render(
      <Tab
        id="one"
        label="One"
        isActive={false}
        onPress={jest.fn()}
        testID="tab-one"
      />
    );

    const tab = screen.getByTestId('tab-one');
    const containerStyle = getContainerStyle(tab, false, false);
    const state = __TAB_TESTING__.getTabState('light', false, false, false);

    expect(containerStyle.backgroundColor).toBe(state.outerBackgroundColor);
    expect(containerStyle.borderColor).toBe(state.borderColor);
    expect(containerStyle.borderBottomWidth).toBe(state.borderBottomWidth);

    const pill = getRenderedPill(tab, false, false);
    expect(pill).not.toBeNull();
    const pillStyle = getStyleObject((pill as React.ReactElement<any>).props.style) as { backgroundColor?: string };
    expect(pillStyle.backgroundColor).toBe(state.pillBackgroundColor);

    const text = getRenderedText(pill);
    expect(text).not.toBeNull();
    expect((text as React.ReactElement<any>).props.style.color).toBe(state.textColor);
  });

  it('applies active styles to container, pill, and text', () => {
    render(
      <Tab
        id="one"
        label="One"
        isActive={true}
        onPress={jest.fn()}
        testID="tab-one"
      />
    );

    const tab = screen.getByTestId('tab-one');
    const containerStyle = getContainerStyle(tab, false, false);
    const state = __TAB_TESTING__.getTabState('light', true, false, false);

    expect(containerStyle.backgroundColor).toBe(state.outerBackgroundColor);
    expect(containerStyle.borderColor).toBe(state.borderColor);
    expect(containerStyle.borderBottomWidth).toBe(state.borderBottomWidth);

    const pill = getRenderedPill(tab, false, false);
    expect(pill).not.toBeNull();
    const pillStyle = getStyleObject((pill as React.ReactElement<any>).props.style) as { backgroundColor?: string };
    expect(pillStyle.backgroundColor).toBe(state.pillBackgroundColor);

    const text = getRenderedText(pill);
    expect(text).not.toBeNull();
    expect((text as React.ReactElement<any>).props.style.color).toBe(state.textColor);
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
    expect(state.outerBackgroundColor).toBe(Colors.light.background.neutral.default);
    expect(state.pillBackgroundColor).toBe('transparent');
    expect(state.textVariant).toBe('singleLineBody');
    expect(state.textColor).toBe(Colors.light.text.neutral.onNeutral);
    expect(state.borderBottomWidth).toBe(Size.stroke.border);
  });

  it('returns hover state colors for inactive hover', () => {
    const state = __TAB_TESTING__.getTabState('dark', false, false, true);
    expect(state.pillBackgroundColor).toBe(Colors.dark.background.neutral.hover);
    expect(state.textVariant).toBe('singleLineBody');
    expect(state.textColor).toBe(Colors.dark.text.neutral.onNeutral);
  });

  it('returns pressed state colors for inactive pressed', () => {
    const state = __TAB_TESTING__.getTabState('dark', false, true, false);
    expect(state.pillBackgroundColor).toBe(Colors.dark.background.neutral.pressed);
    expect(state.textVariant).toBe('singleLineBody');
    expect(state.textColor).toBe(Colors.dark.text.neutral.onNeutral);
  });
});
