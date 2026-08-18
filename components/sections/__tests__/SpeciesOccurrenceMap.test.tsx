// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react';
import fs from 'fs';
import path from 'path';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import { SpeciesOccurrenceMap } from '../SpeciesOccurrenceMap';
import * as speciesOccurrenceMapHelpers from '../speciesOccurrenceMap/speciesOccurrenceMapHelpers';

const realLeafletTemplate = fs.readFileSync(
  path.join(__dirname, '../speciesOccurrenceMap/SpeciesOccurrenceMap.html'),
  'utf8',
);

const mockPostMessage = jest.fn();

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('react-native-webview', () => {
  const mockReact = jest.requireActual('react');
  const { View: MockView } = jest.requireActual('react-native');
  type MockWebViewProps = Record<string, unknown>;

  return {
    WebView: mockReact.forwardRef(
      (props: MockWebViewProps, ref: React.Ref<unknown>) => {
        mockReact.useImperativeHandle(ref, () => ({
          postMessage: mockPostMessage,
        }));

        return mockReact.createElement(MockView, {
          testID: 'mock-webview',
          ...props,
        });
      },
    ),
  };
});

describe('SpeciesOccurrenceMap', () => {
  const loadMapTemplateSpy = jest.spyOn(
    speciesOccurrenceMapHelpers,
    'loadMapTemplate',
  );
  const loadFallbackMapTemplateSpy = jest.spyOn(
    speciesOccurrenceMapHelpers,
    'loadFallbackMapTemplate',
  );
  const openURLSpy = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValue(undefined);

  const resolvedTemplate =
    '<html><body><div id="map"></div><script>leaflet</script></body></html>';
  const originalWindow = global.window;

  const renderMapWithOccurrences = async (
    platform: 'ios' | 'web',
    props: React.ComponentProps<typeof SpeciesOccurrenceMap>,
  ) => {
    Object.defineProperty(Platform, 'OS', { value: platform });
    render(<SpeciesOccurrenceMap {...props} />);
    await waitFor(
      () => {
        expect(screen.queryByText('Loading map renderer…')).toBeNull();
      },
      { timeout: 5000 },
    );
  };

  afterEach(() => {
    // Unmount while the (possibly stubbed) window from this test is still
    // in place — effect cleanups (e.g. useResponsive's resize listener) run
    // during unmount and need a window with real addEventListener/
    // removeEventListener, which `originalWindow` below may not provide.
    cleanup();
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    mockPostMessage.mockClear();
    openURLSpy.mockClear();
    loadMapTemplateSpy.mockReset();
    loadFallbackMapTemplateSpy.mockReset();
    global.window = originalWindow;
  });

  beforeEach(() => {
    loadMapTemplateSpy.mockResolvedValue(resolvedTemplate);
    loadFallbackMapTemplateSpy.mockResolvedValue(resolvedTemplate);
  });

  it('renders loading state', () => {
    render(<SpeciesOccurrenceMap occurrences={[]} loading={true} />);
    expect(screen.getByText('Loading observations map…')).toBeTruthy();
  });

  it('renders error state', () => {
    render(<SpeciesOccurrenceMap occurrences={[]} error={'Map failed'} />);
    expect(screen.getByText('Map failed')).toBeTruthy();
  });

  it('renders empty state when no occurrences', () => {
    render(<SpeciesOccurrenceMap occurrences={[]} />);
    expect(
      screen.getByText(
        'No precise observation coordinates available for this species.',
      ),
    ).toBeTruthy();
  });

  it('renders map container for heatmap-only mode without occurrences', async () => {
    await renderMapWithOccurrences('ios', {
      occurrences: [],
      showMarkers: false,
      heatmapTileUrl: 'https://tiles.example.test/{z}/{x}/{y}.png',
    });

    expect(
      screen.queryByText(
        'No precise observation coordinates available for this species.',
      ),
    ).toBeNull();
    expect(screen.getByTestId('mock-webview')).toBeTruthy();
  });

  it('renders map container when occurrences exist (native branch)', async () => {
    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 1, latitude: 10, longitude: 20 }],
    });

    const webView = screen.getByTestId('mock-webview');
    expect(webView).toBeTruthy();
    expect(webView.props.source.baseUrl).toBe('https://wherewild.net/');
  });

  it('posts highlight message after native map load completes', async () => {
    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 101, latitude: 10, longitude: 20 }],
      highlightedCatalogs: [101],
    });

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');

    expect(mockPostMessage).toHaveBeenCalled();
    expect(
      mockPostMessage.mock.calls.some(
        ([payload]) =>
          typeof payload === 'string' &&
          payload.includes('highlight') &&
          payload.includes('101'),
      ),
    ).toBe(true);
  });

  it('posts selected point message after native map load completes', async () => {
    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 101, latitude: 10, longitude: 20 }],
      selectedPoint: { lat: 40, lon: -111 },
    });

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');

    expect(mockPostMessage).toHaveBeenCalled();
    expect(mockPostMessage.mock.calls.at(-1)?.[0]).toContain('selected_point');
    expect(mockPostMessage.mock.calls.at(-1)?.[0]).toContain('40');
    expect(mockPostMessage.mock.calls.at(-1)?.[0]).toContain('-111');
  });

  it('posts updated highlight messages after the native map is already ready', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { rerender } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 101, latitude: 10, longitude: 20 }]}
        highlightedCatalogs={[101]}
      />,
    );

    await waitFor(
      () => {
        expect(screen.queryByText('Loading map renderer…')).toBeNull();
      },
      { timeout: 5000 },
    );

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');
    const initialCallCount = mockPostMessage.mock.calls.length;

    rerender(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 101, latitude: 10, longitude: 20 }]}
        highlightedCatalogs={[202]}
      />,
    );

    await waitFor(() => {
      expect(
        mockPostMessage.mock.calls
          .slice(initialCallCount)
          .some(
            ([payload]) =>
              typeof payload === 'string' && payload.includes('202'),
          ),
      ).toBe(true);
    });
  });

  it('still pushes the color-scale globals (isCircular etc.) via pointStylesUpdate when there are zero occurrences (e.g. maps.tsx, which has no markers at all)', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { rerender } = render(
      <SpeciesOccurrenceMap
        occurrences={[]}
        showMarkers={false}
        preserveMapPosition
        heatmapTileUrl='https://tiles.example.test/{z}/{x}/{y}.png'
        isCircular={false}
      />,
    );

    await waitFor(
      () => {
        expect(screen.queryByText('Loading map renderer…')).toBeNull();
      },
      { timeout: 5000 },
    );

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');
    mockPostMessage.mockClear();

    // Switching to a circular variable with occurrences still empty (as on
    // maps.tsx, which never has occurrence markers) must still push
    // isCircular:true — the point-query popup reads it even without any
    // markers to recolor.
    rerender(
      <SpeciesOccurrenceMap
        occurrences={[]}
        showMarkers={false}
        preserveMapPosition
        heatmapTileUrl='https://tiles.example.test/{z}/{x}/{y}.png'
        isCircular={true}
      />,
    );

    await waitFor(() => {
      expect(
        mockPostMessage.mock.calls.some(
          ([payload]) =>
            typeof payload === 'string' &&
            payload.includes('pointStylesUpdate') &&
            payload.includes('"isCircular":true'),
        ),
      ).toBe(true);
    });
  });

  it('resets mapReady on html changes and waits for next load event', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { rerender } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 10, latitude: 10, longitude: 20 }]}
        highlightedCatalogs={[10]}
      />,
    );

    await waitFor(
      () => {
        expect(screen.queryByText('Loading map renderer…')).toBeNull();
      },
      { timeout: 5000 },
    );

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');
    const callCountAfterFirstLoad = mockPostMessage.mock.calls.length;

    rerender(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 20, latitude: 11, longitude: 21 }]}
        highlightedCatalogs={[20]}
      />,
    );

    await waitFor(
      () => {
        expect(screen.queryByText('Loading map renderer…')).toBeNull();
      },
      { timeout: 5000 },
    );

    expect(mockPostMessage.mock.calls.length).toBeGreaterThanOrEqual(
      callCountAfterFirstLoad,
    );

    fireEvent(screen.getByTestId('mock-webview'), 'loadEnd');
    expect(mockPostMessage.mock.calls.length).toBeGreaterThan(
      callCountAfterFirstLoad,
    );
    expect(
      mockPostMessage.mock.calls
        .slice(callCountAfterFirstLoad)
        .some(
          ([payload]) => typeof payload === 'string' && payload.includes('20'),
        ),
    ).toBe(true);
  });

  it('renders map container when occurrences exist (web branch)', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    global.window = {
      ...originalWindow,
      innerWidth: 1440,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as Window & typeof globalThis;
    const { UNSAFE_getByProps, unmount } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 2, latitude: 11, longitude: 21 }]}
      />,
    );

    await waitFor(
      () => {
        expect(screen.queryByText('Loading map renderer…')).toBeNull();
      },
      { timeout: 5000 },
    );

    const iframe = UNSAFE_getByProps({ title: 'Observation map' });
    expect(iframe).toBeTruthy();
    expect(iframe.props.srcDoc).toContain('<div id="map"></div>');
    expect(iframe.props.src).toBeUndefined();
    expect(iframe.props.sandbox).toContain('allow-same-origin');
    expect(iframe.props.referrerPolicy).toBe('strict-origin-when-cross-origin');

    // Unmount now, while the stubbed window (with real addEventListener/
    // removeEventListener) above is still in place — effect cleanups (e.g.
    // useResponsive's resize listener, mounted transitively via the globe
    // toggle's ThemedText label) read `window` at cleanup time, not mount
    // time, so tearing down after `originalWindow` is restored in afterEach
    // would throw.
    unmount();
  });

  it('always shows the heatmap overlay when the basemap mode toggle is disabled, regardless of the shared basemapMode setting', async () => {
    // Regression test: maps.tsx passes enableBasemapModeToggle={false} and
    // relies on its heatmap tiles always being visible — it has no toggle UI
    // to ever set the shared/global settings.basemapMode to 'variable'
    // itself, so this map must not be gated by whatever that setting was
    // last left at (e.g. 'standard', from browsing the species page).
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    global.window = {
      ...originalWindow,
      innerWidth: 1440,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as Window & typeof globalThis;
    loadMapTemplateSpy.mockResolvedValue(realLeafletTemplate);

    const { UNSAFE_getByProps, unmount } = render(
      <SpeciesOccurrenceMap
        occurrences={[]}
        showMarkers={false}
        heatmapTileUrl='https://tiles.example.test/{z}/{x}/{y}.png'
        enableBasemapModeToggle={false}
        // Pins this test to the mocked loadMapTemplate (online) path — this
        // test is about basemapMode placeholder substitution, which is
        // identical between the online/offline templates, not about
        // enableOfflineFallback (which now defaults to true).
        enableOfflineFallback={false}
      />,
    );

    await waitFor(
      () => {
        expect(screen.queryByText('Loading map renderer…')).toBeNull();
      },
      { timeout: 5000 },
    );

    const iframe = UNSAFE_getByProps({ title: 'Observation map' });
    expect(iframe.props.srcDoc).toContain(
      'const BASEMAP_MODE_INITIAL = "variable";',
    );

    unmount();
  });

  it('opens external observation URLs from native webview messages', async () => {
    // This harness can reliably assert the native WebView message path only.
    // The web branch depends on iframe-originated postMessage plus window.open,
    // which React Native test rendering does not model well enough here.
    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 101, latitude: 10, longitude: 20 }],
    });

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'open_external_url',
          url: 'https://www.inaturalist.org/observations/123',
        }),
      },
    });

    expect(openURLSpy).toHaveBeenCalledWith(
      'https://www.inaturalist.org/observations/123',
    );
  });

  it('shows an explicit fallback warning when the external template load fails', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    loadMapTemplateSpy.mockResolvedValue(null);
    loadFallbackMapTemplateSpy.mockResolvedValue(resolvedTemplate);

    render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 3, latitude: 12, longitude: 22 }]}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          'Unable to load the bundled map renderer. Showing the fallback map.',
        ),
      ).toBeTruthy();
    });

    const webView = screen.getByTestId('mock-webview');
    expect(webView.props.source.html).toContain('leaflet');
  });

  it('shows an explicit error when both renderer templates fail to load', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    loadMapTemplateSpy.mockResolvedValue(null);
    loadFallbackMapTemplateSpy.mockResolvedValue(null);

    render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 4, latitude: 13, longitude: 23 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Unable to load the map renderer.')).toBeTruthy();
    });

    expect(screen.queryByTestId('mock-webview')).toBeNull();
  });

  it('forwards native pin-observation messages from the webview', async () => {
    const handlePinObservation = jest.fn();

    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 9, latitude: 13, longitude: 23 }],
      onPinObservation: handlePinObservation,
    });

    fireEvent(screen.getByTestId('mock-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'pin_observation',
          catalogNumber: 'obs-9',
          latitude: 13,
          longitude: 23,
        }),
      },
    });

    expect(handlePinObservation).toHaveBeenCalledWith('obs-9', 13, 23);
    expect(handlePinObservation).toHaveBeenCalledTimes(1);
  });

  it('forwards native bounds-changed messages from the webview', async () => {
    const handleBoundsChange = jest.fn();

    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 9, latitude: 13, longitude: 23 }],
      onBoundsChange: handleBoundsChange,
    });

    fireEvent(screen.getByTestId('mock-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'tilesChanged',
          z: 8,
          x0: 40,
          y0: 90,
          x1: 42,
          y1: 92,
        }),
      },
    });

    expect(handleBoundsChange).toHaveBeenCalledWith({
      type: 'tilesChanged',
      z: 8,
      x0: 40,
      y0: 90,
      x1: 42,
      y1: 92,
    });
  });

  it('ignores malformed native messages without crashing', async () => {
    const handlePinObservation = jest.fn();
    const handleBoundsChange = jest.fn();

    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 9, latitude: 13, longitude: 23 }],
      onBoundsChange: handleBoundsChange,
      onPinObservation: handlePinObservation,
    });

    fireEvent(screen.getByTestId('mock-webview'), 'message', {
      nativeEvent: { data: '{not-json' },
    });

    expect(handlePinObservation).not.toHaveBeenCalled();
    expect(handleBoundsChange).not.toHaveBeenCalled();
  });
});
