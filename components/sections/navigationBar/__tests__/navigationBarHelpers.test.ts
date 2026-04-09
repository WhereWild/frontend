import { Animated } from 'react-native';
import {
  animateIndicatorPressedProgress,
  animateIndicatorToLayout,
  findTabIndexAtPoint,
  hasHostLayoutChanged,
  isIndicatorAwayFromActiveTab,
  resolveNavigationTabForegroundTone,
  resolveNavigationTabState,
  shouldRemeasureWidth,
} from '../navigationBarHelpers';

describe('navigationBarHelpers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('evaluates host layout and remeasure thresholds', () => {
    expect(hasHostLayoutChanged(null, 100, 20)).toBe(true);
    expect(hasHostLayoutChanged({ width: 100, height: 20 }, 100, 20)).toBe(
      false,
    );
    expect(hasHostLayoutChanged({ width: 100, height: 20 }, 120, 20)).toBe(
      true,
    );
    expect(hasHostLayoutChanged({ width: 100, height: 20 }, 100, 24)).toBe(
      true,
    );

    expect(shouldRemeasureWidth(null, 100, 1)).toBe(true);
    expect(shouldRemeasureWidth(100, 101, 1)).toBe(false);
    expect(shouldRemeasureWidth(100, 102, 1)).toBe(true);
  });

  it('hit-tests tab frames and resolves tab state/tone helpers', () => {
    const tabs = [{ key: 'home' }, { key: 'search' }];
    const tabLayouts = {
      home: { x: 0, y: 0, width: 80, height: 40 },
      search: { x: 90, y: 0, width: 80, height: 40 },
    };

    expect(findTabIndexAtPoint(tabs, tabLayouts, 10, 10)).toBe(0);
    expect(findTabIndexAtPoint(tabs, tabLayouts, 100, 10)).toBe(1);
    expect(findTabIndexAtPoint(tabs, tabLayouts, 300, 10)).toBeNull();

    expect(isIndicatorAwayFromActiveTab(1, null)).toBe(false);
    expect(isIndicatorAwayFromActiveTab(1, 1)).toBe(false);
    expect(isIndicatorAwayFromActiveTab(1, 0)).toBe(true);

    expect(resolveNavigationTabState(1, 1, null)).toBe('active');
    expect(resolveNavigationTabState(1, 1, 0)).toBe('default');
    expect(resolveNavigationTabState(0, 1, 0)).toBe('pressed');
    expect(resolveNavigationTabState(2, 1, 0)).toBe('default');

    expect(resolveNavigationTabForegroundTone(1, 1, null)).toBe('default');
    expect(resolveNavigationTabForegroundTone(1, 1, 0)).toBe('brand');
    expect(resolveNavigationTabForegroundTone(0, 1, 0)).toBe('default');
  });

  it('snaps indicator immediately during resize mode', () => {
    const indicatorX = new Animated.Value(0);
    const indicatorWidth = new Animated.Value(0);
    const stopX = jest.spyOn(indicatorX, 'stopAnimation');
    const stopW = jest.spyOn(indicatorWidth, 'stopAnimation');
    const setX = jest.spyOn(indicatorX, 'setValue');
    const setW = jest.spyOn(indicatorWidth, 'setValue');

    animateIndicatorToLayout({
      indicatorX,
      indicatorWidth,
      targetLayout: { x: 40, y: 0, width: 120, height: 40 },
      duration: 160,
      easing: (value) => value,
      isResizing: true,
    });

    expect(stopX).toHaveBeenCalled();
    expect(stopW).toHaveBeenCalled();
    expect(setX).toHaveBeenCalledWith(40);
    expect(setW).toHaveBeenCalledWith(120);
  });

  it('animates indicator values and pressed progress when not resizing', () => {
    const indicatorX = new Animated.Value(0);
    const indicatorWidth = new Animated.Value(0);
    const indicatorPressedProgress = new Animated.Value(0);

    const timingStart = jest.fn();
    const parallelStart = jest.fn();
    const timingSpy = jest
      .spyOn(Animated, 'timing')
      .mockReturnValue({ start: timingStart } as never);
    const parallelSpy = jest
      .spyOn(Animated, 'parallel')
      .mockReturnValue({ start: parallelStart } as never);

    animateIndicatorToLayout({
      indicatorX,
      indicatorWidth,
      targetLayout: { x: 20, y: 0, width: 100, height: 40 },
      duration: 160,
      easing: (value) => value,
      isResizing: false,
    });

    expect(timingSpy).toHaveBeenCalledTimes(2);
    expect(parallelSpy).toHaveBeenCalledTimes(1);
    expect(parallelStart).toHaveBeenCalledTimes(1);

    animateIndicatorPressedProgress({
      indicatorPressedProgress,
      previewIndex: 0,
      duration: 160,
      easing: (value) => value,
    });

    animateIndicatorPressedProgress({
      indicatorPressedProgress,
      previewIndex: null,
      duration: 160,
      easing: (value) => value,
    });

    expect(timingSpy).toHaveBeenCalledTimes(4);
    expect(timingStart).toHaveBeenCalledTimes(2);
  });
});
