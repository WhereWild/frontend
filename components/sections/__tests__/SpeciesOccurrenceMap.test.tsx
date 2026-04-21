import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import { SpeciesOccurrenceMap } from '../SpeciesOccurrenceMap';
import * as speciesOccurrenceMapHelpers from '../speciesOccurrenceMap/speciesOccurrenceMapHelpers';

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
    await waitFor(() => {
      expect(screen.queryByText('Loading map renderer…')).toBeNull();
    });
  };

  afterEach(() => {
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
    expect(
      mockPostMessage.mock.calls.some(
        ([payload]) =>
          typeof payload === 'string' &&
          payload.includes('selected_point') &&
          payload.includes('40') &&
          payload.includes('-111'),
      ),
    ).toBe(true);
  });

  it('posts set_heatmap_overlay after native map load completes', async () => {
    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 101, latitude: 10, longitude: 20 }],
      heatmapTileUrl: 'https://tiles.example.test/species/{z}/{x}/{y}.png',
    });

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');

    expect(
      mockPostMessage.mock.calls.some(
        ([payload]) =>
          typeof payload === 'string' &&
          payload.includes('set_heatmap_overlay') &&
          payload.includes(
            'https://tiles.example.test/species/{z}/{x}/{y}.png',
          ),
      ),
    ).toBe(true);
  });

  it('updates the heatmap overlay without waiting for another map load', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { rerender } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 101, latitude: 10, longitude: 20 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading map renderer…')).toBeNull();
    });

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');
    const callCountAfterLoad = mockPostMessage.mock.calls.length;

    rerender(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 101, latitude: 10, longitude: 20 }]}
        heatmapTileUrl='https://tiles.example.test/species/{z}/{x}/{y}.png'
      />,
    );

    await waitFor(() => {
      expect(
        mockPostMessage.mock.calls
          .slice(callCountAfterLoad)
          .some(
            ([payload]) =>
              typeof payload === 'string' &&
              payload.includes('set_heatmap_overlay') &&
              payload.includes(
                'https://tiles.example.test/species/{z}/{x}/{y}.png',
              ),
          ),
      ).toBe(true);
    });
  });

  it('posts updated highlight messages after the native map is already ready', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { rerender } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 101, latitude: 10, longitude: 20 }]}
        highlightedCatalogs={[101]}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading map renderer…')).toBeNull();
    });

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

  it('resets mapReady on html changes and waits for next load event', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { rerender } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 10, latitude: 10, longitude: 20 }]}
        highlightedCatalogs={[10]}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading map renderer…')).toBeNull();
    });

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');
    const callCountAfterFirstLoad = mockPostMessage.mock.calls.length;

    rerender(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 20, latitude: 11, longitude: 21 }]}
        highlightedCatalogs={[20]}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading map renderer…')).toBeNull();
    });

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
    const { UNSAFE_getByProps } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 2, latitude: 11, longitude: 21 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading map renderer…')).toBeNull();
    });

    const iframe = UNSAFE_getByProps({ title: 'Observation map' });
    expect(iframe).toBeTruthy();
    expect(iframe.props.srcDoc).toContain('<div id="map"></div>');
    expect(iframe.props.src).toBeUndefined();
    expect(iframe.props.sandbox).toContain('allow-same-origin');
    expect(iframe.props.referrerPolicy).toBe('strict-origin-when-cross-origin');
  });

  it('posts set_heatmap_overlay through the web iframe runtime path', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    const webPostMessage = jest.fn();
    global.window = {
      ...originalWindow,
      innerWidth: 1440,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as unknown as Window & typeof globalThis;

    const { UNSAFE_getByProps } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 2, latitude: 11, longitude: 21 }]}
        heatmapTileUrl='https://tiles.example.test/species/{z}/{x}/{y}.png'
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading map renderer…')).toBeNull();
    });

    const iframe = UNSAFE_getByProps({ title: 'Observation map' });
    iframe.props.ref.current = {
      contentWindow: { postMessage: webPostMessage },
    };

    fireEvent(iframe, 'load');

    await waitFor(() => {
      expect(
        webPostMessage.mock.calls.some(
          ([payload, targetOrigin]) =>
            targetOrigin === '*' &&
            payload?.type === 'set_heatmap_overlay' &&
            payload?.tileUrl ===
              'https://tiles.example.test/species/{z}/{x}/{y}.png',
        ),
      ).toBe(true);
    });
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

  it('opens external observation URLs through window.open on web iframe messages and removes listeners on unmount', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    const open = jest.fn();
    let messageHandler:
      | ((event: { data: unknown; source: unknown }) => void)
      | undefined;

    addEventListener.mockImplementation((type, handler) => {
      if (type === 'message') {
        messageHandler = handler as (event: {
          data: unknown;
          source: unknown;
        }) => void;
      }
    });

    global.window = {
      ...originalWindow,
      innerWidth: 1440,
      addEventListener,
      removeEventListener,
      open,
    } as unknown as Window & typeof globalThis;

    const { UNSAFE_getByProps, unmount } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 2, latitude: 11, longitude: 21 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading map renderer…')).toBeNull();
    });

    const iframe = UNSAFE_getByProps({ title: 'Observation map' });
    const frameWindow = {};
    iframe.props.ref.current = {
      contentWindow: frameWindow,
    };

    expect(messageHandler).toBeDefined();

    messageHandler?.({
      source: frameWindow,
      data: {
        type: 'open_external_url',
        url: 'https://www.inaturalist.org/observations/456',
      },
    });

    expect(open).toHaveBeenCalledWith(
      'https://www.inaturalist.org/observations/456',
      '_blank',
      'noopener,noreferrer',
    );
    expect(openURLSpy).not.toHaveBeenCalled();

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'message',
      expect.any(Function),
    );
  });

  it('forwards matching heatmap status messages and ignores mismatched overlay URLs', async () => {
    const handleHeatmapStatusChange = jest.fn();

    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 9, latitude: 13, longitude: 23 }],
      heatmapTileUrl: 'https://tiles.example.test/species/{z}/{x}/{y}.png',
      onHeatmapStatusChange: handleHeatmapStatusChange,
    });

    fireEvent(screen.getByTestId('mock-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'heatmap_status',
          status: 'unavailable',
          tileUrl: 'https://tiles.example.test/other/{z}/{x}/{y}.png',
        }),
      },
    });

    expect(handleHeatmapStatusChange).not.toHaveBeenCalled();

    fireEvent(screen.getByTestId('mock-webview'), 'message', {
      nativeEvent: {
        data: JSON.stringify({
          type: 'heatmap_status',
          status: 'unavailable',
          tileUrl: 'https://tiles.example.test/species/{z}/{x}/{y}.png',
        }),
      },
    });

    expect(handleHeatmapStatusChange).toHaveBeenCalledWith({
      type: 'heatmap_status',
      status: 'unavailable',
      tileUrl: 'https://tiles.example.test/species/{z}/{x}/{y}.png',
    });
  });

  it('renders reinforcement feedback points even when there are no occurrences', async () => {
    const buildLeafletHtmlSpy = jest.spyOn(
      speciesOccurrenceMapHelpers,
      'buildLeafletHtml',
    );

    await renderMapWithOccurrences('ios', {
      occurrences: [],
      feedbackPoints: [
        { lat: 41, lon: -112, present: true },
        { lat: 42, lon: -113, present: false },
      ],
    });

    expect(buildLeafletHtmlSpy).toHaveBeenCalled();
    const mapPoints = buildLeafletHtmlSpy.mock.calls.at(-1)?.[1];
    expect(mapPoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          catalogNumber: 'point:feedback:present:0',
          latitude: 41,
          longitude: -112,
          alwaysShow: true,
          disableObservationLink: true,
          markerRadius: 5,
        }),
        expect.objectContaining({
          catalogNumber: 'point:feedback:absent:1',
          latitude: 42,
          longitude: -113,
          alwaysShow: true,
          disableObservationLink: true,
          markerRadius: 5,
        }),
      ]),
    );
    expect(
      screen.queryByText(
        'No precise observation coordinates available for this species.',
      ),
    ).toBeNull();

    buildLeafletHtmlSpy.mockRestore();
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
