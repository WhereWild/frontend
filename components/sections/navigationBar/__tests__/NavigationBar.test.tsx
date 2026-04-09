import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { create } from 'react-test-renderer';
import { __NAVIGATION_BAR_TESTING__, NavigationBar } from '../NavigationBar';
import { NavigationBarTab } from '../NavigationBarTab';
import { View } from 'react-native';

const HORIZONTAL_MIN_TAB_WIDTH = 96;
const TAB_GAP = 8;

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('NavigationBar', () => {
  const createdRenderers: ReturnType<typeof create>[] = [];

  const createRenderer = (element: React.ReactElement) => {
    let renderer: ReturnType<typeof create> | undefined;
    act(() => {
      renderer = create(element);
    });
    if (!renderer) {
      throw new Error('NavigationBar renderer was not created.');
    }

    createdRenderers.push(renderer);
    return renderer;
  };

  afterEach(() => {
    act(() => {
      createdRenderers.splice(0).forEach((renderer) => renderer.unmount());
    });
  });

  const getTabVariants = (renderer: ReturnType<typeof create>) =>
    renderer.root
      .findAllByType(NavigationBarTab)
      .filter((node) => node.props.onLayout === undefined)
      .map((node) => node.props.variant);

  const getMeasuringTabNodes = (renderer: ReturnType<typeof create>) =>
    renderer.root
      .findAllByType(NavigationBarTab)
      .filter((node) => typeof node.props.onLayout === 'function');

  const getVisibleTabNodes = (renderer: ReturnType<typeof create>) =>
    renderer.root
      .findAllByType(NavigationBarTab)
      .filter((node) => typeof node.props.onContainerLayout === 'function');

  const getActiveIndicatorNodes = (renderer: ReturnType<typeof create>) =>
    renderer.root.findAll(
      (node) => node.props?.testID === 'navigation-bar-active-indicator',
    );

  const getTabsLayoutView = (renderer: ReturnType<typeof create>) => {
    const layoutView = renderer.root
      .findAllByType(View)
      .find((node) => typeof node.props.onLayout === 'function');

    if (!layoutView) {
      throw new Error('Could not find tabs layout view.');
    }

    return layoutView;
  };

  const measureAllTabs = (
    renderer: ReturnType<typeof create>,
    widths: number[],
  ) => {
    const tabNodes = getMeasuringTabNodes(renderer);
    act(() => {
      tabNodes.forEach((tab, index) => {
        tab.props.onLayout?.(widths[index] ?? HORIZONTAL_MIN_TAB_WIDTH);
      });
    });
    return tabNodes;
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
        accessibilityLabel='Bottom nav'
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
    const expectedWidth =
      100 + 120 + HORIZONTAL_MIN_TAB_WIDTH + (tabCount - 1) * TAB_GAP;
    const required = __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
      3,
      {
        one: 100,
        two: 120,
        three: 96,
      },
      ['one', 'two', 'three'],
    );

    expect(required).toBe(expectedWidth);
  });

  it('falls back to minimum width for tabs without measurements', () => {
    const tabCount = 3;
    const required = __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
      tabCount,
      {
        one: 120,
      },
      ['one', 'two', 'three'],
    );

    expect(required).toBe(
      120 +
        HORIZONTAL_MIN_TAB_WIDTH +
        HORIZONTAL_MIN_TAB_WIDTH +
        (tabCount - 1) * TAB_GAP,
    );
  });

  it('uses horizontal when there is enough width and vertical when not', () => {
    const tabCount = 3;
    const measuredTabWidths = {
      one: 100,
      two: 120,
      three: HORIZONTAL_MIN_TAB_WIDTH,
    };
    const tabKeys = ['one', 'two', 'three'];
    const requiredWidth = __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
      tabCount,
      measuredTabWidths,
      tabKeys,
    );
    const horizontal = __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
      requiredWidth,
      tabCount,
      measuredTabWidths,
      tabKeys,
    );

    const vertical = __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
      requiredWidth - 1,
      tabCount,
      measuredTabWidths,
      tabKeys,
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

  it('uses deterministic threshold at the required width boundary', () => {
    const tabCount = 3;
    const measuredTabWidths = {
      one: 100,
      two: 120,
      three: HORIZONTAL_MIN_TAB_WIDTH,
    };
    const tabKeys = ['one', 'two', 'three'];
    const requiredWidth = __NAVIGATION_BAR_TESTING__.getRequiredHorizontalWidth(
      tabCount,
      measuredTabWidths,
      tabKeys,
    );
    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
        requiredWidth,
        tabCount,
        measuredTabWidths,
        tabKeys,
      ),
    ).toBe(true);

    expect(
      __NAVIGATION_BAR_TESTING__.shouldUseHorizontalVariant(
        requiredWidth - 1,
        tabCount,
        measuredTabWidths,
        tabKeys,
      ),
    ).toBe(false);
  });

  it('starts horizontal during measuring, then resolves variants from measured width', async () => {
    const renderer = createRenderer(<NavigationBar />);

    // Initial render is the measuring fallback: visible layer stays horizontal
    // until width + tab measurements are available.
    expect(
      getTabVariants(renderer).every((variant) => variant === 'horizontal'),
    ).toBe(true);
    expect(getMeasuringTabNodes(renderer).length).toBeGreaterThan(0);

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

    measureAllTabs(renderer, [
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
    ]);

    // After finalize, the hidden measuring layer stays mounted to keep the
    // native host tree stable during teardown and reload.
    expect(getMeasuringTabNodes(renderer)).toHaveLength(5);
    expect(
      getTabVariants(renderer).every((variant) => variant === 'horizontal'),
    ).toBe(true);

    act(() => {
      tabsLayoutView.props.onLayout({
        nativeEvent: {
          layout: {
            width: 260,
          },
        },
      });
    });

    measureAllTabs(renderer, [
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
    ]);

    await waitFor(() => {
      expect(
        getTabVariants(renderer).every((variant) => variant === 'vertical'),
      ).toBe(true);
    });
  });

  it('uses tab onLayout measurements to update variant decisions', async () => {
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

    const tabNodes = getMeasuringTabNodes(renderer);

    expect(
      tabNodes.every((tab) => typeof tab.props.onLayout === 'function'),
    ).toBe(true);

    measureAllTabs(renderer, [
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
    ]);

    expect(
      getTabVariants(renderer).every((variant) => variant === 'horizontal'),
    ).toBe(true);

    const tabNodesAfterFinalize = getMeasuringTabNodes(renderer);
    expect(tabNodesAfterFinalize).toHaveLength(5);

    act(() => {
      tabsLayoutView.props.onLayout({
        nativeEvent: {
          layout: {
            width: 620,
          },
        },
      });
    });

    const tabNodesAfterSameWidth = getMeasuringTabNodes(renderer);
    expect(tabNodesAfterSameWidth).toHaveLength(5);

    act(() => {
      tabsLayoutView.props.onLayout({
        nativeEvent: {
          layout: {
            width: 560,
          },
        },
      });
    });

    const tabNodesDuringReMeasure = getMeasuringTabNodes(renderer);
    expect(
      tabNodesDuringReMeasure.every(
        (tab) => typeof tab.props.onLayout === 'function',
      ),
    ).toBe(true);

    measureAllTabs(renderer, [
      240,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
    ]);

    await waitFor(() => {
      expect(
        getTabVariants(renderer).every((variant) => variant === 'vertical'),
      ).toBe(true);
    });
  });

  it('shows active indicator after initial horizontal measurement without resize', () => {
    const renderer = createRenderer(<NavigationBar />);
    const tabsLayoutView = getTabsLayoutView(renderer);

    act(() => {
      tabsLayoutView.props.onLayout({
        nativeEvent: {
          layout: {
            width: 620,
            height: 56,
          },
        },
      });
    });

    measureAllTabs(renderer, [
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
      HORIZONTAL_MIN_TAB_WIDTH,
    ]);

    const visibleTabs = getVisibleTabNodes(renderer);

    act(() => {
      visibleTabs.forEach((tab, index) => {
        tab.props.onContainerLayout?.({
          x: index * (HORIZONTAL_MIN_TAB_WIDTH + TAB_GAP),
          y: 0,
          width: HORIZONTAL_MIN_TAB_WIDTH,
          height: 40,
        });
      });
    });

    expect(getMeasuringTabNodes(renderer)).toHaveLength(5);
    expect(
      getTabVariants(renderer).every((variant) => variant === 'horizontal'),
    ).toBe(true);
    expect(getActiveIndicatorNodes(renderer).length).toBeGreaterThan(0);
  });

  it('keeps measuring state unchanged when layout width is zero', () => {
    const renderer = createRenderer(<NavigationBar />);
    const tabsLayoutView = getTabsLayoutView(renderer);

    act(() => {
      tabsLayoutView.props.onLayout({
        nativeEvent: {
          layout: {
            width: 0,
          },
        },
      });
    });

    expect(getMeasuringTabNodes(renderer).length).toBeGreaterThan(0);
    expect(
      getTabVariants(renderer).every((variant) => variant === 'horizontal'),
    ).toBe(true);
  });

  it('finalizes measuring immediately for one-tab configurations', () => {
    const renderer = createRenderer(
      <NavigationBar
        tabs={[
          {
            key: 'only',
            label: 'Only',
            icon: () => null,
          },
        ]}
      />,
    );
    const tabsLayoutView = getTabsLayoutView(renderer);

    act(() => {
      tabsLayoutView.props.onLayout({
        nativeEvent: {
          layout: {
            width: 320,
          },
        },
      });
    });

    expect(getMeasuringTabNodes(renderer)).toHaveLength(1);
    expect(getTabVariants(renderer)).toEqual(['horizontal']);
  });

  it('ignores duplicate tab measurement while still collecting widths', () => {
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

    const tabNodes = getMeasuringTabNodes(renderer);
    const [firstTab, ...remainingTabs] = tabNodes;

    act(() => {
      firstTab?.props.onLayout?.(HORIZONTAL_MIN_TAB_WIDTH);
      firstTab?.props.onLayout?.(HORIZONTAL_MIN_TAB_WIDTH);
      remainingTabs.forEach((tab) =>
        tab.props.onLayout?.(HORIZONTAL_MIN_TAB_WIDTH),
      );
    });

    expect(getMeasuringTabNodes(renderer)).toHaveLength(5);
    expect(
      getTabVariants(renderer).every((variant) => variant === 'horizontal'),
    ).toBe(true);
  });

  it('ignores duplicate tab measurement after all widths are collected', () => {
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

    const tabNodes = getMeasuringTabNodes(renderer);
    const [firstTab] = tabNodes;

    act(() => {
      tabNodes.forEach((tab) => tab.props.onLayout?.(HORIZONTAL_MIN_TAB_WIDTH));
      firstTab?.props.onLayout?.(HORIZONTAL_MIN_TAB_WIDTH);
    });

    expect(getMeasuringTabNodes(renderer)).toHaveLength(5);
    expect(
      getTabVariants(renderer).every((variant) => variant === 'horizontal'),
    ).toBe(true);
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
