import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SpeciesOccurrenceMap } from '../SpeciesOccurrenceMap';

const mockPostMessage = jest.fn();

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
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
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    mockPostMessage.mockClear();
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

  it('renders map container when occurrences exist (native branch)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 1, latitude: 10, longitude: 20 }]}
      />,
    );

    expect(screen.getByTestId('mock-webview')).toBeTruthy();
    expect(
      screen.queryByText('No precise observation coordinates available for this species.'),
    ).toBeNull();
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('posts highlight message after native map load completes', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 101, latitude: 10, longitude: 20 }]}
        highlightedCatalogs={[101]}
      />,
    );

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');

    expect(mockPostMessage).toHaveBeenCalled();
    const highlightCall = mockPostMessage.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('highlight'),
    );
    expect(highlightCall).toBeDefined();
    expect(highlightCall![0]).toContain('101');
  });

  it('resets mapReady on html changes and waits for next load event', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { rerender } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 10, latitude: 10, longitude: 20 }]}
        highlightedCatalogs={[10]}
      />,
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

    expect(mockPostMessage.mock.calls.length).toBeGreaterThanOrEqual(callCountAfterFirstLoad);

    fireEvent(screen.getByTestId('mock-webview'), 'loadEnd');
    expect(mockPostMessage.mock.calls.length).toBeGreaterThan(callCountAfterFirstLoad);
    const highlightCall = mockPostMessage.mock.calls.find(
      (call, idx) => idx >= callCountAfterFirstLoad && typeof call[0] === 'string' && call[0].includes('highlight'),
    );
    expect(highlightCall).toBeDefined();
    expect(highlightCall![0]).toContain('20');
  });

  it('updates heatmap settings without waiting for another map load', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    const { rerender } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 10, latitude: 10, longitude: 20 }]}
        speciesKey={10}
        showHeatmapOverlay={false}
      />,
    );

    const webView = screen.getByTestId('mock-webview');
    fireEvent(webView, 'loadEnd');
    mockPostMessage.mockClear();

    rerender(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 10, latitude: 10, longitude: 20 }]}
        speciesKey={10}
        showHeatmapOverlay={true}
      />,
    );

    const settingsCall = mockPostMessage.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('heatmap-settings'),
    );
    expect(settingsCall).toBeDefined();
    expect(settingsCall![0]).toContain('"enabled":true');
    expect(settingsCall![0]).toContain('"speciesKey":10');
  });

  it('renders map container when occurrences exist (web branch)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    const { UNSAFE_getByProps } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 2, latitude: 11, longitude: 21 }]}
      />,
    );

    expect(UNSAFE_getByProps({ title: 'Observation map' })).toBeTruthy();
    expect(
      screen.queryByText('No precise observation coordinates available for this species.'),
    ).toBeNull();
  });
});
