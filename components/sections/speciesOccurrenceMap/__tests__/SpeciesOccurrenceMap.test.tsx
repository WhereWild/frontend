import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { SpeciesOccurrenceMap } from '../SpeciesOccurrenceMap';

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
    const { toJSON } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 1, latitude: 10, longitude: 20 }]}
      />,
    );

    expect(toJSON()).toBeTruthy();
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
    expect(mockPostMessage.mock.calls.at(-1)?.[0]).toContain('highlight');
    expect(mockPostMessage.mock.calls.at(-1)?.[0]).toContain('101');
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
    expect(mockPostMessage.mock.calls.at(-1)?.[0]).toContain('20');
  });

  it('renders map container when occurrences exist (web branch)', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' });
    const { toJSON } = render(
      <SpeciesOccurrenceMap
        occurrences={[{ catalogNumber: 2, latitude: 11, longitude: 21 }]}
      />,
    );

    expect(toJSON()).toBeTruthy();
  });
});
