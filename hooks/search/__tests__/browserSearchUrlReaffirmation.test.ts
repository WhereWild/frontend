import {
  getCurrentBrowserSearchUrl,
  scheduleBrowserSearchUrlReaffirmation,
} from '../browserSearchUrlReaffirmation';

describe('browserSearchUrlReaffirmation', () => {
  const originalLocation = window.location;
  const originalHistory = window.history;

  const setWindowLocation = (pathname?: string, search?: string) => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname,
        search,
      },
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    setWindowLocation('/search', '?query=oak');
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: null,
        replaceState: jest.fn(),
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: originalHistory,
    });
  });

  it('returns the current browser search url when pathname and search are available', () => {
    expect(getCurrentBrowserSearchUrl()).toBe('/search?query=oak');
  });

  it('returns null when pathname or search are unavailable', () => {
    setWindowLocation(undefined, '?query=oak');
    expect(getCurrentBrowserSearchUrl()).toBeNull();

    setWindowLocation('/search', undefined);
    expect(getCurrentBrowserSearchUrl()).toBeNull();
  });

  it('replaces browser history when expo router replays the targeted stale url', () => {
    const replaceState = jest.fn();
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: { search: { filterVisible: false } },
        replaceState,
      },
    });
    setWindowLocation('/search', '?query=stale');

    scheduleBrowserSearchUrlReaffirmation(
      '/search?query=expected',
      '/search?query=stale',
      true,
    );

    jest.runAllTimers();

    expect(replaceState).toHaveBeenCalledWith(
      { search: { filterVisible: true } },
      '',
      '/search?query=expected',
    );
  });

  it('does not replace browser history when the current url already matches the expected url', () => {
    const replaceState = jest.fn();
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: null,
        replaceState,
      },
    });
    setWindowLocation('/search', '?query=expected');

    scheduleBrowserSearchUrlReaffirmation(
      '/search?query=expected',
      '/search?query=stale',
      false,
    );

    jest.runAllTimers();

    expect(replaceState).not.toHaveBeenCalled();
  });

  it('does not replace browser history when a different same-path url is active', () => {
    const replaceState = jest.fn();
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: null,
        replaceState,
      },
    });
    setWindowLocation('/search', '?query=newer');

    scheduleBrowserSearchUrlReaffirmation(
      '/search?query=expected',
      '/search?query=stale',
      false,
    );

    jest.runAllTimers();

    expect(replaceState).not.toHaveBeenCalled();
  });

  it('does not replace browser history when the browser has navigated to a different pathname', () => {
    const replaceState = jest.fn();
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: null,
        replaceState,
      },
    });
    setWindowLocation('/species/123', '?query=stale');

    scheduleBrowserSearchUrlReaffirmation(
      '/search?query=expected',
      '/search?query=stale',
      false,
    );

    jest.runAllTimers();

    expect(replaceState).not.toHaveBeenCalled();
  });

  it('does not replace browser history when the current browser search url becomes unavailable', () => {
    const replaceState = jest.fn();
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: null,
        replaceState,
      },
    });

    scheduleBrowserSearchUrlReaffirmation(
      '/search?query=expected',
      '/search?query=stale',
      false,
    );

    setWindowLocation(undefined, undefined);
    jest.runAllTimers();

    expect(replaceState).not.toHaveBeenCalled();
  });

  it('returns a no-op cancel function when history replacement is unavailable', () => {
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: null,
      },
    });

    const cancel = scheduleBrowserSearchUrlReaffirmation(
      '/search?query=expected',
      '/search?query=stale',
      false,
    );

    expect(cancel).toEqual(expect.any(Function));
    expect(() => cancel()).not.toThrow();
  });

  it('cancels a pending reaffirmation before the timer runs', () => {
    const replaceState = jest.fn();
    Object.defineProperty(window, 'history', {
      configurable: true,
      value: {
        state: null,
        replaceState,
      },
    });
    setWindowLocation('/search', '?query=stale');

    const cancel = scheduleBrowserSearchUrlReaffirmation(
      '/search?query=expected',
      '/search?query=stale',
      false,
    );
    cancel();

    jest.runAllTimers();

    expect(replaceState).not.toHaveBeenCalled();
  });
});
