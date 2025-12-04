import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { PageHeaderMobile, type PageHeaderMobileProps } from '../sections/PageHeaderMobile';
import { Colors, Size } from '@/constants/theme';

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

    const { getByLabelText, getByTestId, getAllByTestId, queryByTestId, rerender } = render(
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

    const wrappers = getAllByTestId('page-header-mobile-action-wrapper');
    fireEvent(wrappers[0], 'layout', {
      nativeEvent: { layout: { width: 120, height: 32, x: 0, y: 0 } },
    });
    fireEvent(wrappers[1], 'layout', {
      nativeEvent: { layout: { width: 160, height: 32, x: 0, y: 0 } },
    });

    const actionsCard = getByTestId('page-header-mobile-actions-card');
    const inlineStyles = findStyleObject(actionsCard.props.style, style =>
      'top' in style && 'width' in style,
    ) as Record<string, number | undefined> | undefined;
    expect(inlineStyles).toBeDefined();
    expect(inlineStyles?.top).toBe(72 + Size.space['200']);
    expect(inlineStyles?.width).toBe(160 + Size.space['400']);
  });

  it('resets max action width when the action set changes', () => {
    const initialActions: PageHeaderMobileProps['actions'] = [
      { label: 'Download', icon: <View />, onPress: jest.fn() },
    ];

    const { getByTestId, getAllByTestId, rerender } = render(
      <PageHeaderMobile
        {...createProps({
          showMenuButton: true,
          mobileMenuExpanded: true,
          actions: initialActions,
        })}
      />,
    );

    const toolbar = getByTestId('page-header-mobile-toolbar');
    fireEvent(toolbar, 'layout', {
      nativeEvent: { layout: { height: 60, width: 200, x: 0, y: 0 } },
    });

    const firstWrapper = getAllByTestId('page-header-mobile-action-wrapper')[0];
    fireEvent(firstWrapper, 'layout', {
      nativeEvent: { layout: { width: 140, height: 28, x: 0, y: 0 } },
    });

    let actionsCard = getByTestId('page-header-mobile-actions-card');
    let inlineStyles = findStyleObject(actionsCard.props.style, style => 'width' in style) as
      | Record<string, number | undefined>
      | undefined;
    expect(inlineStyles?.width).toBe(140 + Size.space['400']);

    const updatedActions: PageHeaderMobileProps['actions'] = [
      { label: 'Inspect', icon: <View />, onPress: jest.fn() },
    ];

    rerender(
      <PageHeaderMobile
        {...createProps({
          showMenuButton: true,
          mobileMenuExpanded: true,
          actions: updatedActions,
        })}
      />,
    );

    actionsCard = getByTestId('page-header-mobile-actions-card');
    inlineStyles = findStyleObject(actionsCard.props.style, style => 'width' in style) as
      | Record<string, number | undefined>
      | undefined;
    expect(inlineStyles?.width).toBeUndefined();

    const updatedWrapper = getAllByTestId('page-header-mobile-action-wrapper')[0];
    fireEvent(updatedWrapper, 'layout', {
      nativeEvent: { layout: { width: 100, height: 28, x: 0, y: 0 } },
    });

    actionsCard = getByTestId('page-header-mobile-actions-card');
    inlineStyles = findStyleObject(actionsCard.props.style, style => 'width' in style) as
      | Record<string, number | undefined>
      | undefined;
    expect(inlineStyles?.width).toBe(100 + Size.space['400']);
  });
});
