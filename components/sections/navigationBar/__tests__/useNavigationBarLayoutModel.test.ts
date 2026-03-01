import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNavigationBarLayoutModel } from '../useNavigationBarLayoutModel';

describe('useNavigationBarLayoutModel', () => {
  it('resolves variant from measured tab widths and supports hit-testing', async () => {
    const tabs = [{ key: 'home' }, { key: 'search' }];
    const resolveTabVariant = jest.fn((availableWidth: number): 'horizontal' | 'vertical' =>
      availableWidth >= 300 ? 'horizontal' : 'vertical');

    const { result } = renderHook(() => useNavigationBarLayoutModel({
      tabs,
      tabKeys: ['home', 'search'],
      resolveTabVariant,
      resizeSettleDelayMs: 50,
      remeasureThresholdPx: 1,
    }));

    act(() => {
      result.current.handleTabsLayout(360, 56);
      result.current.onTabWidthLayout('home', 120);
      result.current.onTabWidthLayout('search', 120);
      result.current.handleTabContainerLayout('home', { x: 0, y: 0, width: 120, height: 40 });
      result.current.handleTabContainerLayout('search', { x: 130, y: 0, width: 120, height: 40 });
    });

    await waitFor(() => {
      expect(result.current.isMeasuring).toBe(false);
      expect(result.current.resolvedVariant).toBe('horizontal');
    });

    expect(resolveTabVariant).toHaveBeenCalled();
    expect(result.current.getTabIndexAtPoint(10, 10)).toBe(0);
    expect(result.current.getTabIndexAtPoint(140, 10)).toBe(1);
    expect(result.current.getTabIndexAtPoint(400, 10)).toBeNull();
    expect(result.current.tabKeySignature).toBe('home|search');
  });

  it('keeps measuring horizontal when there is one tab', async () => {
    const tabs = [{ key: 'home' }];
    const resolveTabVariant = jest.fn((): 'horizontal' | 'vertical' => 'vertical');

    const { result } = renderHook(() => useNavigationBarLayoutModel({
      tabs,
      tabKeys: ['home'],
      resolveTabVariant,
      resizeSettleDelayMs: 50,
      remeasureThresholdPx: 1,
    }));

    act(() => {
      result.current.handleTabsLayout(180, 56);
    });

    await waitFor(() => {
      expect(result.current.isMeasuring).toBe(false);
      expect(result.current.resolvedVariant).toBe('horizontal');
    });

    expect(resolveTabVariant).not.toHaveBeenCalled();
  });

  it('does not remeasure when width delta is below threshold', async () => {
    const tabs = [{ key: 'home' }, { key: 'search' }];
    const resolveTabVariant = jest.fn((availableWidth: number): 'horizontal' | 'vertical' =>
      availableWidth >= 300 ? 'horizontal' : 'vertical');

    const { result } = renderHook(() => useNavigationBarLayoutModel({
      tabs,
      tabKeys: ['home', 'search'],
      resolveTabVariant,
      resizeSettleDelayMs: 50,
      remeasureThresholdPx: 1,
    }));

    act(() => {
      result.current.handleTabsLayout(360, 56);
      result.current.onTabWidthLayout('home', 120);
      result.current.onTabWidthLayout('search', 120);
      result.current.handleTabContainerLayout('home', { x: 0, y: 0, width: 120, height: 40 });
    });

    await waitFor(() => {
      expect(result.current.isMeasuring).toBe(false);
      expect(result.current.resolvedVariant).toBe('horizontal');
    });

    const stableLayoutsRef = result.current.tabLayouts;

    act(() => {
      result.current.handleTabContainerLayout('home', { x: 0, y: 0, width: 120, height: 40 });
      result.current.handleTabsLayout(360.5, 56);
    });

    expect(result.current.tabLayouts).toBe(stableLayoutsRef);
    expect(resolveTabVariant).toHaveBeenCalledTimes(1);
  });

  it('preserves measured tab widths across resize remeasure sessions', async () => {
    const tabs = [{ key: 'home' }, { key: 'search' }];
    const resolveTabVariant = jest.fn((
      availableWidth: number,
      _tabCount: number,
      _measuredTabWidths: Record<string, number>,
      _tabKeys: string[],
    ): 'horizontal' | 'vertical' =>
      availableWidth >= 240 ? 'horizontal' : 'vertical');

    const { result } = renderHook(() => useNavigationBarLayoutModel({
      tabs,
      tabKeys: ['home', 'search'],
      resolveTabVariant,
      resizeSettleDelayMs: 50,
      remeasureThresholdPx: 1,
    }));

    act(() => {
      result.current.handleTabsLayout(360, 56);
      result.current.onTabWidthLayout('home', 130);
      result.current.onTabWidthLayout('search', 140);
    });

    await waitFor(() => {
      expect(result.current.isMeasuring).toBe(false);
      expect(result.current.resolvedVariant).toBe('horizontal');
    });

    act(() => {
      result.current.handleTabsLayout(250, 56);
    });

    await waitFor(() => {
      expect(result.current.isMeasuring).toBe(false);
    });

    const secondCallArgs = resolveTabVariant.mock.calls[1];
    expect(secondCallArgs?.[2]).toEqual({ home: 130, search: 140 });
  });

  it('does not temporarily switch variant from fallback widths during resize', async () => {
    const tabs = [{ key: 'home' }, { key: 'search' }, { key: 'about' }, { key: 'settings' }];
    const tabKeys = ['home', 'search', 'about', 'settings'];
    const tabGap = 8;

    const resolveTabVariant = jest.fn((
      availableWidth: number,
      tabCount: number,
      measuredTabWidths: Record<string, number>,
      resolverTabKeys: string[],
    ): 'horizontal' | 'vertical' => {
      const totalTabWidth = resolverTabKeys.reduce((sum, key) => sum + (measuredTabWidths[key] ?? 96), 0);
      const requiredWidth = totalTabWidth + Math.max(0, tabCount - 1) * tabGap;
      return availableWidth >= requiredWidth ? 'horizontal' : 'vertical';
    });

    const { result } = renderHook(() => useNavigationBarLayoutModel({
      tabs,
      tabKeys,
      resolveTabVariant,
      resizeSettleDelayMs: 50,
      remeasureThresholdPx: 1,
    }));

    act(() => {
      result.current.handleTabsLayout(470, 56);
      result.current.onTabWidthLayout('home', 100);
      result.current.onTabWidthLayout('search', 100);
      result.current.onTabWidthLayout('about', 108);
      result.current.onTabWidthLayout('settings', 112);
    });

    await waitFor(() => {
      expect(result.current.isMeasuring).toBe(false);
      expect(result.current.resolvedVariant).toBe('horizontal');
    });

    act(() => {
      result.current.handleTabsLayout(430, 56);
    });

    await waitFor(() => {
      expect(result.current.isMeasuring).toBe(false);
      expect(result.current.resolvedVariant).toBe('vertical');
    });

    const secondCallArgs = resolveTabVariant.mock.calls[1];
    expect(secondCallArgs?.[2]).toEqual({
      home: 100,
      search: 100,
      about: 108,
      settings: 112,
    });
  });
});
