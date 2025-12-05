import { Colors, Size } from '@/constants/theme';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PageHeaderMobile, type PageHeaderMobileProps } from '../PageHeaderMobile';

jest.mock('@/assets/icons', () => ({
  IconFilter: () => null,
  IconMenu: () => null,
  IconSearch: () => null,
  IconX: () => null,
}));

const palette = Colors.light;

const createProps = (overrides: Partial<PageHeaderMobileProps> = {}): PageHeaderMobileProps => ({
  palette,
  logoContent: (
    <View testID="page-header-mobile-logo">
      <Text>WhereWild</Text>
    </View>
  ),
  searchPlaceholder: 'Search species',
  actions: [],
  showFilterButton: false,
  filterButtonAccessibilityLabel: 'Filter species',
  showMenuButton: false,
  mobileMenuExpanded: false,
  menuAccessibilityLabel: 'Open menu',
  onLogoPress: jest.fn(),
  logoAccessibilityLabel: 'WhereWild home',
  logoIsButton: false,
  ...overrides,
});

const findStyleObject = (
  styleProp: unknown,
  predicate: (style: Record<string, unknown>) => boolean = () => true,
) => {
  if (Array.isArray(styleProp)) {
    return styleProp.find(
      (style): style is Record<string, unknown> =>
        Boolean(style) && typeof style === 'object' && !Array.isArray(style) && predicate(style),
    );
  }

  if (styleProp && typeof styleProp === 'object') {
    const styleObject = styleProp as Record<string, unknown>;
    return predicate(styleObject) ? styleObject : undefined;
  }

  return undefined;
};

describe('PageHeaderMobile', () => {
  it('wires logo presses and search events', () => {
    const onLogoPress = jest.fn();
    const onSearchChange = jest.fn();
    const onSubmitSearch = jest.fn();

    const { getByLabelText, getByPlaceholderText } = render(
      <PageHeaderMobile
        {...createProps({
          onLogoPress,
          searchValue: 'owl',
          onSearchChange,
          onSubmitSearch,
        })}
      />,
    );

    fireEvent.press(getByLabelText('WhereWild home'));
    expect(onLogoPress).toHaveBeenCalled();

    const input = getByPlaceholderText('Search species');
    fireEvent.changeText(input, 'fox');
    expect(onSearchChange).toHaveBeenCalledWith('fox');

    fireEvent(input, 'submitEditing', { nativeEvent: { text: 'fox' } });
    expect(onSubmitSearch).toHaveBeenCalledWith('fox');
  });

  it('renders filter/menu buttons and action overlays when expanded', () => {
    const onFilterPress = jest.fn();
    const onMenuPress = jest.fn();

    const actions: PageHeaderMobileProps['actions'] = [
      { label: 'Save search', icon: <View />, onPress: jest.fn() },
      { label: 'Share', icon: <View />, onPress: jest.fn(), variant: 'neutral' },
    ];

    const { getByLabelText, getByTestId, queryByTestId, rerender } = render(
      <PageHeaderMobile
        {...createProps({
          showFilterButton: true,
          onFilterPress,
          showMenuButton: true,
          onMenuPress,
          mobileMenuExpanded: false,
          actions,
        })}
      />,
    );

    expect(queryByTestId('page-header-mobile-actions-card')).toBeNull();

    fireEvent.press(getByLabelText('Filter species'));
    expect(onFilterPress).toHaveBeenCalled();

    fireEvent.press(getByLabelText('Open menu'));
    expect(onMenuPress).toHaveBeenCalledTimes(1);

    rerender(
      <PageHeaderMobile
        {...createProps({
          showFilterButton: true,
          onFilterPress,
          showMenuButton: true,
          onMenuPress,
          mobileMenuExpanded: true,
          actions,
        })}
      />,
    );

    const toolbar = getByTestId('page-header-mobile-toolbar');
    fireEvent(toolbar, 'layout', {
      nativeEvent: { layout: { height: 72, width: 200, x: 0, y: 0 } },
    });

    const actionsCard = getByTestId('page-header-mobile-actions-card');
    const topStyles = findStyleObject(actionsCard.props.style, style => 'top' in style) as
      | Record<string, number | undefined>
      | undefined;
    const widthStyles = findStyleObject(actionsCard.props.style, style => 'width' in style) as
      | Record<string, number | undefined>
      | undefined;
    expect(topStyles?.top).toBe(72 + Size.space['200']);
    expect(widthStyles?.width).toBe(Size.space['4000']);
  });

  it('keeps the action card width token-based across rerenders', () => {
    const { getByTestId, rerender } = render(
      <PageHeaderMobile
        {...createProps({
          showMenuButton: true,
          mobileMenuExpanded: true,
          actions: [{ label: 'Download', icon: <View />, onPress: jest.fn() }],
        })}
      />,
    );

    const toolbar = getByTestId('page-header-mobile-toolbar');
    fireEvent(toolbar, 'layout', {
      nativeEvent: { layout: { height: 60, width: 200, x: 0, y: 0 } },
    });

    const actionsCard = getByTestId('page-header-mobile-actions-card');
    const initialStyles = findStyleObject(actionsCard.props.style, style => 'width' in style) as
      | Record<string, number | undefined>
      | undefined;
    expect(initialStyles?.width).toBe(Size.space['4000']);

    rerender(
      <PageHeaderMobile
        {...createProps({
          showMenuButton: true,
          mobileMenuExpanded: true,
          actions: [
            { label: 'Inspect', icon: <View />, onPress: jest.fn() },
            { label: 'Archive', icon: <View />, onPress: jest.fn() },
          ],
        })}
      />,
    );

    const updatedCard = getByTestId('page-header-mobile-actions-card');
    const updatedStyles = findStyleObject(updatedCard.props.style, style => 'width' in style) as
      | Record<string, number | undefined>
      | undefined;
    expect(updatedStyles?.width).toBe(Size.space['4000']);
  });

  it('allows the logo content to handle presses when logoIsButton is true', () => {
    const customLogoPress = jest.fn();
    const onLogoPress = jest.fn();

    const { getByLabelText, queryByLabelText } = render(
      <PageHeaderMobile
        {...createProps({
          logoIsButton: true,
          onLogoPress,
          logoContent: (
            <Pressable accessibilityLabel="Custom back" onPress={customLogoPress}>
              <Text>Back</Text>
            </Pressable>
          ),
        })}
      />,
    );

    const customButton = getByLabelText('Custom back');
    fireEvent.press(customButton);

    expect(customLogoPress).toHaveBeenCalled();
    expect(onLogoPress).not.toHaveBeenCalled();
    expect(queryByLabelText('WhereWild home')).toBeNull();
  });

});
