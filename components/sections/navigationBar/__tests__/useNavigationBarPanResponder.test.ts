import { act, renderHook } from '@testing-library/react-native';
import { PanResponder } from 'react-native';
import { useNavigationBarPanResponder } from '../useNavigationBarPanResponder';

const makeEvent = (pageX: number, pageY: number) => {
  return {
    nativeEvent: {
      pageX,
      pageY,
    },
  };
};

describe('useNavigationBarPanResponder', () => {
  beforeEach(() => {
    jest.spyOn(PanResponder, 'create').mockImplementation(
      (config: Parameters<typeof PanResponder.create>[0]) =>
        ({
          panHandlers: {
            onStartShouldSetResponderCapture: (event: any, gestureState: any) =>
              config.onStartShouldSetPanResponderCapture?.(
                event,
                gestureState,
              ) ?? false,
            onMoveShouldSetResponderCapture: (event: any, gestureState: any) =>
              config.onMoveShouldSetPanResponderCapture?.(
                event,
                gestureState,
              ) ?? false,
            onResponderGrant: (event: any, gestureState: any) =>
              config.onPanResponderGrant?.(event, gestureState),
            onResponderMove: (event: any, gestureState: any) =>
              config.onPanResponderMove?.(event, gestureState),
            onResponderRelease: (event: any, gestureState: any) =>
              config.onPanResponderRelease?.(event, gestureState),
            onResponderTerminate: (event: any, gestureState: any) =>
              config.onPanResponderTerminate?.(event, gestureState),
            onResponderTerminationRequest: (event: any, gestureState: any) =>
              config.onPanResponderTerminationRequest?.(event, gestureState) ??
              true,
          },
        }) as ReturnType<typeof PanResponder.create>,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('captures, previews and commits tab selection during pan release', () => {
    const getTabIndexAtPoint = jest.fn((x: number) => (x < 50 ? 0 : 1));
    const setPreviewIndex = jest.fn();
    const commitTabSelection = jest.fn();

    const { result } = renderHook(() =>
      useNavigationBarPanResponder({
        getTabIndexAtPoint,
        setPreviewIndex,
        commitTabSelection,
      }),
    );

    const handlers = result.current.panHandlers as any;

    act(() => {
      result.current.tabsHostRef.current = {
        measureInWindow: (
          cb: (x: number, y: number, width: number, height: number) => void,
        ) => {
          cb(0, 0, 300, 48);
        },
      } as never;
    });

    act(() => {
      expect(
        handlers.onStartShouldSetResponderCapture?.(
          makeEvent(10, 5) as never,
          { numberActiveTouches: 1 } as never,
        ),
      ).toBe(true);
      handlers.onResponderGrant?.(makeEvent(10, 5) as never);
      handlers.onResponderMove?.(
        makeEvent(10, 5) as never,
        { moveX: 10, moveY: 5 } as never,
      );
      handlers.onResponderRelease?.(
        makeEvent(80, 5) as never,
        { moveX: 80, moveY: 5 } as never,
      );
    });

    expect(setPreviewIndex).toHaveBeenCalledWith(0);
    expect(setPreviewIndex).toHaveBeenCalledWith(1);
    expect(commitTabSelection).toHaveBeenCalledWith(1);

    expect(result.current.shouldHandleTabPress()).toBe(false);
    expect(result.current.shouldHandleTabPress()).toBe(true);
  });

  it('does not capture pan when initial hit-test misses all tabs', () => {
    const getTabIndexAtPoint = jest.fn(() => null);
    const setPreviewIndex = jest.fn();
    const commitTabSelection = jest.fn();

    const { result } = renderHook(() =>
      useNavigationBarPanResponder({
        getTabIndexAtPoint,
        setPreviewIndex,
        commitTabSelection,
      }),
    );

    const handlers = result.current.panHandlers as any;

    act(() => {
      result.current.tabsHostRef.current = {
        measureInWindow: (
          cb: (x: number, y: number, width: number, height: number) => void,
        ) => {
          cb(0, 0, 300, 48);
        },
      } as never;
    });

    expect(
      handlers.onStartShouldSetResponderCapture?.(
        makeEvent(500, 10) as never,
        { numberActiveTouches: 1 } as never,
      ),
    ).toBe(false);
    expect(commitTabSelection).not.toHaveBeenCalled();
  });

  it('commits the last previewed tab when release misses all tabs', () => {
    const getTabIndexAtPoint = jest
      .fn()
      .mockImplementationOnce(() => 0)
      .mockImplementation(() => null);
    const setPreviewIndex = jest.fn();
    const commitTabSelection = jest.fn();

    const { result } = renderHook(() =>
      useNavigationBarPanResponder({
        getTabIndexAtPoint,
        setPreviewIndex,
        commitTabSelection,
      }),
    );

    const handlers = result.current.panHandlers as any;

    act(() => {
      result.current.tabsHostRef.current = {
        measureInWindow: (
          cb: (x: number, y: number, width: number, height: number) => void,
        ) => {
          cb(0, 0, 300, 48);
        },
      } as never;
    });

    act(() => {
      handlers.onStartShouldSetResponderCapture?.(
        makeEvent(10, 5) as never,
        { numberActiveTouches: 1 } as never,
      );
      handlers.onResponderGrant?.(makeEvent(10, 5) as never);
      handlers.onResponderRelease?.(
        makeEvent(500, 5) as never,
        { moveX: 500, moveY: 5 } as never,
      );
    });

    expect(commitTabSelection).toHaveBeenCalledWith(0);
    expect(setPreviewIndex).not.toHaveBeenCalledWith(null);
  });

  it('returns early when host ref is missing and when host measure is invalid', () => {
    const getTabIndexAtPoint = jest.fn(() => 0);
    const setPreviewIndex = jest.fn();
    const commitTabSelection = jest.fn();

    const { result } = renderHook(() =>
      useNavigationBarPanResponder({
        getTabIndexAtPoint,
        setPreviewIndex,
        commitTabSelection,
      }),
    );

    const handlers = result.current.panHandlers as any;

    expect(
      handlers.onStartShouldSetResponderCapture?.(
        makeEvent(10, 5) as never,
        { numberActiveTouches: 1 } as never,
      ),
    ).toBe(false);

    act(() => {
      result.current.tabsHostRef.current = {
        measureInWindow: (
          cb: (x: number, y: number, width: number, height: number) => void,
        ) => {
          cb(0, 0, 0, 0);
        },
      } as never;
    });

    expect(
      handlers.onStartShouldSetResponderCapture?.(
        makeEvent(10, 5) as never,
        { numberActiveTouches: 1 } as never,
      ),
    ).toBe(false);
    expect(getTabIndexAtPoint).not.toHaveBeenCalled();
  });

  it('does not preview or commit when move/release happen while inactive', () => {
    const getTabIndexAtPoint = jest.fn(() => 0);
    const setPreviewIndex = jest.fn();
    const commitTabSelection = jest.fn();

    const { result } = renderHook(() =>
      useNavigationBarPanResponder({
        getTabIndexAtPoint,
        setPreviewIndex,
        commitTabSelection,
      }),
    );

    const handlers = result.current.panHandlers as any;

    expect(
      handlers.onMoveShouldSetResponderCapture?.(
        makeEvent(10, 5) as never,
        {} as never,
      ),
    ).toBe(false);

    act(() => {
      handlers.onResponderMove?.(
        makeEvent(40, 10) as never,
        { moveX: 40, moveY: 10 } as never,
      );
      handlers.onResponderRelease?.(
        makeEvent(40, 10) as never,
        { moveX: 40, moveY: 10 } as never,
      );
    });

    expect(getTabIndexAtPoint).not.toHaveBeenCalled();
    expect(commitTabSelection).not.toHaveBeenCalled();
    expect(setPreviewIndex).not.toHaveBeenCalled();
  });

  it('clears preview without commit when release has no hit and no prior preview', () => {
    const getTabIndexAtPoint = jest.fn(() => null);
    const setPreviewIndex = jest.fn();
    const commitTabSelection = jest.fn();

    const { result } = renderHook(() =>
      useNavigationBarPanResponder({
        getTabIndexAtPoint,
        setPreviewIndex,
        commitTabSelection,
      }),
    );

    const handlers = result.current.panHandlers as any;

    act(() => {
      result.current.tabsHostRef.current = {
        measureInWindow: (
          cb: (x: number, y: number, width: number, height: number) => void,
        ) => {
          cb(0, 0, 300, 48);
        },
      } as never;
    });

    act(() => {
      handlers.onResponderGrant?.(makeEvent(10, 5) as never);
      handlers.onResponderRelease?.(
        makeEvent(500, 5) as never,
        { moveX: 500, moveY: 5 } as never,
      );
    });

    expect(commitTabSelection).not.toHaveBeenCalled();
    expect(setPreviewIndex).toHaveBeenLastCalledWith(null);
  });

  it('handles terminate and termination request while active', () => {
    const getTabIndexAtPoint = jest.fn((x: number) => (x < 50 ? 0 : 1));
    const setPreviewIndex = jest.fn();
    const commitTabSelection = jest.fn();

    const { result } = renderHook(() =>
      useNavigationBarPanResponder({
        getTabIndexAtPoint,
        setPreviewIndex,
        commitTabSelection,
      }),
    );

    const handlers = result.current.panHandlers as any;

    act(() => {
      result.current.tabsHostRef.current = {
        measureInWindow: (
          cb: (x: number, y: number, width: number, height: number) => void,
        ) => {
          cb(0, 0, 300, 48);
        },
      } as never;
      handlers.onResponderGrant?.(makeEvent(10, 5) as never);
    });

    expect(
      handlers.onMoveShouldSetResponderCapture?.(
        makeEvent(10, 5) as never,
        {} as never,
      ),
    ).toBe(true);
    expect(
      handlers.onResponderTerminationRequest?.(
        makeEvent(10, 5) as never,
        {} as never,
      ),
    ).toBe(true);

    act(() => {
      handlers.onResponderTerminate?.(makeEvent(10, 5) as never, {} as never);
    });

    expect(setPreviewIndex).toHaveBeenLastCalledWith(null);
    expect(result.current.shouldHandleTabPress()).toBe(true);
  });
});
