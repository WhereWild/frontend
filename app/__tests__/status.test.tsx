import { act, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Platform } from 'react-native';

import SystemStatusPage from '../status';

jest.mock('expo-router/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ contentWidth: 720, breakpoint: 'desktop' }),
}));

jest.mock('@/constants/responsiveStyles', () => ({
  getResponsiveContentContainerStyle: jest.fn(() => ({})),
}));

jest.mock('@/components', () => {
  const mockReact = jest.requireActual('react') as typeof React;
  const { View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  return {
    PageScrollContainer: ({ children }: { children: React.ReactNode }) =>
      mockReact.createElement(View, { testID: 'scroll-container' }, children),
  };
});

jest.mock('@/components/PageSurface', () => {
  const mockReact = jest.requireActual('react') as typeof React;
  const { View } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  return {
    PageSurface: ({
      children,
      testID,
    }: {
      children: React.ReactNode;
      testID?: string;
    }) => mockReact.createElement(View, { testID }, children),
  };
});

jest.mock('@/components/sections/PageTitle', () => {
  const mockReact = jest.requireActual('react') as typeof React;
  const { Text } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  return {
    PageTitle: ({ title }: { title: string }) =>
      mockReact.createElement(Text, { testID: 'page-title' }, title),
  };
});

jest.mock('@/components/sections/status/SystemStatusView', () => {
  const mockReact = jest.requireActual('react') as typeof React;
  const { Text } = jest.requireActual(
    'react-native',
  ) as typeof import('react-native');
  return {
    SystemStatusView: ({
      isLoading,
      error,
      status,
    }: {
      isLoading?: boolean;
      error?: string | null;
      status: unknown;
    }) =>
      mockReact.createElement(
        Text,
        { testID: 'system-status-view' },
        isLoading
          ? 'loading'
          : error
            ? `error:${error}`
            : JSON.stringify(status),
      ),
  };
});

jest.mock('@/utils/webMetadata', () => ({
  WebMetadata: () => null,
}));

const MOCK_STATUS_RESPONSE = {
  pipeline: {
    status: 'idle',
    stage: null,
    stage_elapsed_s: null,
    last_finished_at: null,
    last_duration_s: null,
    received_at: null,
  },
  temporal: {
    status: 'idle',
    elapsed_s: null,
    last_finished_at: null,
    last_duration_s: null,
    received_at: null,
  },
  upload_queue: { depth: 0, active: false },
  server: {
    cpu_percent: 5,
    cpu_temp_c: 35,
    ram_used_mb: 1024,
    ram_total_mb: 8192,
    disk_used_gb: 100,
    disk_total_gb: 500,
  },
};

describe('SystemStatusPage', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('renders the page surface', () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_STATUS_RESPONSE,
    });

    render(<SystemStatusPage />);

    expect(screen.getByTestId('status-screen')).toBeTruthy();
  });

  it('shows loading state initially before fetch resolves', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<SystemStatusPage />);

    expect(screen.getByText('loading')).toBeTruthy();
  });

  it('renders status view with data after successful fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_STATUS_RESPONSE,
    });

    render(<SystemStatusPage />);

    await waitFor(() => {
      const view = screen.getByTestId('system-status-view');
      expect(view.props.children).toContain('"active":false');
    });
  });

  it('shows error when fetch fails', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<SystemStatusPage />);

    await waitFor(() => {
      expect(screen.getByText('error:Network error')).toBeTruthy();
    });
  });

  it('shows error when server returns non-ok response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
    });

    render(<SystemStatusPage />);

    await waitFor(() => {
      expect(screen.getByText(/error:Server responded 503/)).toBeTruthy();
    });
  });

  it('polls on an interval', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_STATUS_RESPONSE,
    });

    render(<SystemStatusPage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  });

  it('shows page title on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_STATUS_RESPONSE,
    });

    render(<SystemStatusPage />);

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toBeTruthy();
      expect(screen.getByText('Status')).toBeTruthy();
    });
  });

  it('hides page title on native', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => MOCK_STATUS_RESPONSE,
    });

    render(<SystemStatusPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('page-title')).toBeNull();
    });
  });
});
