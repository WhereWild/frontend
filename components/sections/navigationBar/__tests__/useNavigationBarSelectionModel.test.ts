import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useNavigationBarSelectionModel } from '../useNavigationBarSelectionModel';

describe('useNavigationBarSelectionModel', () => {
  it('updates active selection in uncontrolled mode and calls onPress', () => {
    const onPressHome = jest.fn();
    const onPressSearch = jest.fn();
    const tabs = [
      { key: 'home', onPress: onPressHome },
      { key: 'search', onPress: onPressSearch },
    ];

    const { result } = renderHook(() => useNavigationBarSelectionModel({ tabs }));

    expect(result.current.activeIndex).toBe(0);

    act(() => {
      result.current.setPreviewIndex(1);
    });

    expect(result.current.previewIndex).toBe(1);
    expect(result.current.resolveDerivedState(0)).toBe('default');
    expect(result.current.resolveDerivedState(1)).toBe('pressed');
    expect(result.current.resolveTabForegroundTone(0)).toBe('brand');

    act(() => {
      result.current.commitTabSelection(1);
    });

    expect(onPressSearch).toHaveBeenCalledTimes(1);
    expect(result.current.activeIndex).toBe(1);
    expect(result.current.previewIndex).toBeNull();
  });

  it('keeps active selection controlled by incoming tab state', () => {
    const onPressHome = jest.fn();
    const onPressSearch = jest.fn();
    const tabs = [
      { key: 'home', state: 'default' as const, onPress: onPressHome },
      { key: 'search', state: 'active' as const, onPress: onPressSearch },
    ];

    const { result } = renderHook(() => useNavigationBarSelectionModel({ tabs }));

    expect(result.current.activeIndex).toBe(1);

    act(() => {
      result.current.commitTabSelection(0);
    });

    expect(onPressHome).toHaveBeenCalledTimes(1);
    expect(result.current.activeIndex).toBe(1);
  });

  it('keeps preview state until controlled active index catches up', async () => {
    const onPressHome = jest.fn();
    const onPressSearch = jest.fn();
    type ControlledTab = {
      key: string;
      state: 'active' | 'default';
      onPress: () => void;
    };

    let tabs: ControlledTab[] = [
      { key: 'home', state: 'active' as const, onPress: onPressHome },
      { key: 'search', state: 'default' as const, onPress: onPressSearch },
    ];

    const { result, rerender } = renderHook(
      ({ tabs: hookTabs }: { tabs: ControlledTab[] }) => useNavigationBarSelectionModel({ tabs: hookTabs }),
      {
        initialProps: { tabs },
      },
    );

    act(() => {
      result.current.setPreviewIndex(1);
      result.current.commitTabSelection(1);
    });

    expect(onPressSearch).toHaveBeenCalledTimes(1);
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.previewIndex).toBe(1);

    tabs = [
      { key: 'home', state: 'default' as const, onPress: onPressHome },
      { key: 'search', state: 'active' as const, onPress: onPressSearch },
    ];
    rerender({ tabs });

    await waitFor(() => {
      expect(result.current.activeIndex).toBe(1);
      expect(result.current.previewIndex).toBeNull();
    });
  });

  it('clears preview immediately when controlled commit targets the active tab', () => {
    const onPressHome = jest.fn();
    const tabs = [
      { key: 'home', state: 'active' as const, onPress: onPressHome },
      { key: 'search', state: 'default' as const, onPress: jest.fn() },
    ];

    const { result } = renderHook(() => useNavigationBarSelectionModel({ tabs }));

    act(() => {
      result.current.setPreviewIndex(0);
      result.current.commitTabSelection(0);
    });

    expect(onPressHome).toHaveBeenCalledTimes(1);
    expect(result.current.previewIndex).toBeNull();
  });

  it('safely handles committing an out-of-range index', () => {
    const tabs = [{ key: 'home', state: 'active' as const, onPress: jest.fn() }];
    const { result } = renderHook(() => useNavigationBarSelectionModel({ tabs }));

    act(() => {
      result.current.setPreviewIndex(0);
      result.current.commitTabSelection(99);
    });

    expect(result.current.previewIndex).toBeNull();
  });
});
