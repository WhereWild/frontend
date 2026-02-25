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

  it('computes required horizontal width from measured widths and 200 space gap', () => {
    const required = __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
      3,
      {
        one: 100,
        two: 120,
        three: 96,
      },
      ['one', 'two', 'three'],
    );

    expect(required).toBe(332);
  });

  it('falls back to minimum width when a tab has no measurement', () => {
    const required = __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
      3,
      {
        one: 120,
      },
      ['one', 'two', 'three'],
    );

    expect(required).toBe(328);
  });

  it('uses horizontal when there is enough width and vertical when not', () => {
    const horizontal = __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
      340,
      3,
      {
        one: 100,
        two: 120,
        three: 96,
      },
      ['one', 'two', 'three'],
    );

    const vertical = __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
      320,
      3,
      {
        one: 100,
        two: 120,
        three: 96,
      },
      ['one', 'two', 'three'],
    );

    expect(horizontal).toBe(true);
    expect(vertical).toBe(false);
  });

  it('always uses horizontal when there is one or zero tabs', () => {
    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(0, 1, {}, ['only']),
    ).toBe(true);

    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(0, 0, {}, []),
    ).toBe(true);
  });

  it('adapts all tabs between vertical and horizontal based on measured width', () => {
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

  it('handles measured tab widths and same-width updates without breaking layout decisions', () => {
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

    act(() => {
      tabNodes[0]?.props.onLayout?.(96);
      tabNodes[1]?.props.onLayout?.(96);
      tabNodes[2]?.props.onLayout?.(96);
      tabNodes[3]?.props.onLayout?.(96);
      tabNodes[4]?.props.onLayout?.(96);
    });

    expect(getTabVariants(renderer).every((variant) => variant === 'horizontal')).toBe(true);

    act(() => {
      tabNodes[0]?.props.onLayout?.(96);
    });

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
