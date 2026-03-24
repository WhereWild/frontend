import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
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
    WebView: mockReact.forwardRef((props: MockWebViewProps, ref: React.Ref<unknown>) => {
      mockReact.useImperativeHandle(ref, () => ({
        postMessage: mockPostMessage,
      }));

      return mockReact.createElement(MockView, {
        testID: 'mock-webview',
        ...props,
      });
    }),
  };
});

describe('SpeciesOccurrenceMap', () => {
  const loadMapTemplateSpy = jest.spyOn(speciesOccurrenceMapHelpers, 'loadMapTemplate');
  const loadFallbackMapTemplateSpy = jest.spyOn(speciesOccurrenceMapHelpers, 'loadFallbackMapTemplate');

  const resolvedTemplate = '<html><body><div id="map"></div><script>leaflet</script></body></html>';
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
    expect(screen.getByText('No precise observation coordinates available for this species.')).toBeTruthy();
  });

  it('renders map container when occurrences exist (native branch)', async () => {
    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 1, latitude: 10, longitude: 20 }],
    });

    const webView = screen.getByTestId('mock-webview');
    expect(webView).toBeTruthy();
    expect(webView.props.source.baseUrl).toBe('https://wherewild.app/');
  });

  it('posts highlight message after native map load completes', async () => {
    await renderMapWithOccurrences('ios', {
      occurrences: [{ catalogNumber: 101, latitude: 10, longitude: 20 }],
      highlightedCatalogs: [101],
    });

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');

    expect(mockPostMessage).toHaveBeenCalled();
    expect(mockPostMessage.mock.calls.at(-1)?.[0]).toContain('highlight');
    expect(mockPostMessage.mock.calls.at(-1)?.[0]).toContain('101');
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

    expect(mockPostMessage.mock.calls.length).toBeGreaterThanOrEqual(callCountAfterFirstLoad);

    fireEvent(screen.getByTestId('mock-webview'), 'loadEnd');
    expect(mockPostMessage.mock.calls.length).toBeGreaterThan(callCountAfterFirstLoad);
    expect(mockPostMessage.mock.calls.at(-1)?.[0]).toContain('20');
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
    expect(iframe.props.sandbox).not.toContain('allow-same-origin');
    expect(iframe.props.referrerPolicy).toBe('strict-origin-when-cross-origin');
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
      expect(screen.getByText('Unable to load the bundled map renderer. Showing the fallback map.')).toBeTruthy();
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
});
