import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { create } from 'react-test-renderer';
import {
  __NAVIGATION_BAR_TESTING__,
  NavigationBar,
} from '../../sections/NavigationBar';
import { NavigationBarTab } from '../../sections/NavigationBarTab';
import { View } from 'react-native';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('NavigationBar', () => {
  const createRenderer = (element: React.ReactElement) => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(element);
    });
    if (!renderer) {
      throw new Error('NavigationBar renderer was not created.');
    }
    return renderer;
  };

  const getTabVariants = (renderer: ReturnType<typeof create>) =>
    renderer.root.findAllByType(NavigationBarTab).map((node) => node.props.variant);

  const getTabsLayoutView = (renderer: ReturnType<typeof create>) => {
    const layoutView = renderer.root
      .findAllByType(View)
      .find((node) => typeof node.props.onLayout === 'function');

    if (!layoutView) {
      throw new Error('Could not find tabs layout view.');
    }

    return layoutView;
  };

  it('renders default tabs', () => {
    render(<NavigationBar />);

    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Long Label')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
    expect(screen.getByLabelText('Library')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });

  it('renders custom tabs and accessibility label', () => {
    render(
      <NavigationBar
        accessibilityLabel="Bottom nav"
        tabs={[
          {
            key: 'search',
            label: 'Search',
            icon: () => null,
          },
        ]}
      />,
    );

    expect(screen.getByLabelText('Bottom nav')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
  });

  it('renders with default auto-layout mode', () => {
    render(<NavigationBar />);

    expect(screen.getByLabelText('Navigation bar')).toBeTruthy();
    expect(screen.getByLabelText('Home')).toBeTruthy();
  });

  it('computes required horizontal width from minimum tab width and 200 space gap', () => {
    const tabCount = 3;
    const expectedWidth = tabCount * 96 + (tabCount - 1) * 8;
    const required = __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(3);

    expect(required).toBe(expectedWidth);
  });


  it('uses horizontal when there is enough width and vertical when not', () => {
    const tabCount = 3;
    const requiredWidth = tabCount * 96 + (tabCount - 1) * 8;
    const horizontal = __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
      requiredWidth,
      tabCount,
    );

    const vertical = __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
      requiredWidth - 1,
      tabCount,
    );

    expect(horizontal).toBe(true);
    expect(vertical).toBe(false);
  });

  it('always uses horizontal when there is one or zero tabs', () => {
    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(0, 1),
    ).toBe(true);

    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(0, 0),
    ).toBe(true);
  });

  it('uses deterministic threshold at the required width boundary', () => {
    const tabCount = 3;
    const requiredWidth = tabCount * 96 + (tabCount - 1) * 8;
    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(requiredWidth, tabCount),
    ).toBe(true);

    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(requiredWidth - 1, tabCount),
    ).toBe(false);
  });

  it('adapts all tabs between vertical and horizontal based on available width', () => {
    const renderer = createRenderer(<NavigationBar />);

    expect(getTabVariants(renderer).every((variant) => variant === 'vertical')).toBe(true);

    const tabsLayoutView = getTabsLayoutView(renderer);

    act(() => {
      tabsLayoutView.props.onLayout({
        nativeEvent: {
          layout: {
            width: 640,
          },
        },
      });
    });

    expect(getTabVariants(renderer).every((variant) => variant === 'horizontal')).toBe(true);

    act(() => {
      tabsLayoutView.props.onLayout({
        nativeEvent: {
          layout: {
            width: 260,
          },
        },
      });
    });

    expect(getTabVariants(renderer).every((variant) => variant === 'vertical')).toBe(true);
  });

  it('does not depend on tab onLayout for variant decisions', () => {
    const renderer = createRenderer(<NavigationBar />);
    const tabsLayoutView = getTabsLayoutView(renderer);

    act(() => {
      tabsLayoutView.props.onLayout({
        nativeEvent: {
          layout: {
            width: 620,
          },
        },
      });
    });

    const tabNodes = renderer.root.findAllByType(NavigationBarTab);

    expect(tabNodes.every((tab) => tab.props.onLayout === undefined)).toBe(true);

    expect(getTabVariants(renderer).every((variant) => variant === 'horizontal')).toBe(true);

    expect(getTabVariants(renderer).every((variant) => variant === 'horizontal')).toBe(true);
  });

  it('forwards onPress handlers to tabs', () => {
    const onPress = jest.fn();
    const renderer = createRenderer(
      <NavigationBar
        tabs={[
          {
            key: 'home',
            label: 'Home',
            icon: () => null,
            onPress,
          },
        ]}
      />,
    );

    const [tabNode] = renderer.root.findAllByType(NavigationBarTab);

    act(() => {
      tabNode?.props.onPress?.();
    });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
