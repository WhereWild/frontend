import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { SystemStatusView, type SystemStatusData } from '../SystemStatusView';

jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(() => 'light'),
}));

const MOCK_SERVER: SystemStatusData['server'] = {
  cpu_percent: 10,
  cpu_temp_c: 40,
  ram_used_mb: 2048,
  ram_total_mb: 8192,
  disk_used_gb: 200,
  disk_total_gb: 500,
};

const MOCK_STATUS_RUNNING: SystemStatusData = {
  pipeline: {
    status: 'in_progress',
    stage: 'enrich_tree',
    stage_elapsed_s: 77,
    last_finished_at: null,
    last_duration_s: null,
    received_at: new Date(Date.now() - 80_000).toISOString(),
  },
  temporal: {
    status: 'running',
    elapsed_s: 120,
    last_finished_at: null,
    last_duration_s: null,
    received_at: new Date(Date.now() - 125_000).toISOString(),
  },
  upload_queue: { depth: 2, active: true },
  server: MOCK_SERVER,
};

const MOCK_STATUS_IDLE: SystemStatusData = {
  pipeline: {
    status: 'idle',
    stage: null,
    stage_elapsed_s: null,
    last_finished_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    last_duration_s: 2743,
    received_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
  },
  temporal: {
    status: 'idle',
    elapsed_s: null,
    last_finished_at: new Date(Date.now() - 86400_000).toISOString(),
    last_duration_s: 420,
    received_at: new Date(Date.now() - 86400_000).toISOString(),
  },
  upload_queue: { depth: 0, active: false },
  server: MOCK_SERVER,
};

describe('SystemStatusView', () => {
  describe('loading state', () => {
    it('renders an activity indicator when isLoading and no status', () => {
      const { toJSON } = render(<SystemStatusView isLoading status={null} />);
      expect(toJSON()).not.toBeNull();
      // ActivityIndicator renders, no card titles present
      expect(screen.queryByText('Pipeline')).toBeNull();
    });
  });

  describe('error state', () => {
    it('shows the error message when no status is available', () => {
      render(<SystemStatusView status={null} error='Failed to reach server' />);
      expect(screen.getByText(/Failed to reach server/)).toBeTruthy();
      expect(screen.queryByText('Pipeline')).toBeNull();
    });
  });

  describe('null state', () => {
    it('shows no status available message', () => {
      render(<SystemStatusView status={null} />);
      expect(screen.getByText('No status available')).toBeTruthy();
    });
  });

  describe('error status indicator', () => {
    it('shows error indicator for pipeline with error status', () => {
      render(
        <SystemStatusView
          status={{
            ...MOCK_STATUS_IDLE,
            pipeline: { ...MOCK_STATUS_IDLE.pipeline!, status: 'error' },
          }}
        />,
      );
      expect(screen.getByText(/✗ Error/)).toBeTruthy();
    });

    it('shows error indicator for failed status', () => {
      render(
        <SystemStatusView
          status={{
            ...MOCK_STATUS_IDLE,
            pipeline: { ...MOCK_STATUS_IDLE.pipeline!, status: 'failed' },
          }}
        />,
      );
      expect(screen.getByText(/✗/)).toBeTruthy();
    });
  });

  describe('null temporal', () => {
    it('shows no data indicator when temporal is null', () => {
      render(
        <SystemStatusView status={{ ...MOCK_STATUS_IDLE, temporal: null }} />,
      );
      expect(screen.getByText(/No data/)).toBeTruthy();
    });
  });

  describe('elapsed time formatting', () => {
    it('formats hours correctly', () => {
      render(
        <SystemStatusView
          status={{
            ...MOCK_STATUS_RUNNING,
            temporal: { ...MOCK_STATUS_RUNNING.temporal!, elapsed_s: 7320 },
          }}
        />,
      );
      expect(screen.getByText(/Running for 2h 2m/)).toBeTruthy();
    });

    it('formats exact hours with no minutes', () => {
      render(
        <SystemStatusView
          status={{
            ...MOCK_STATUS_RUNNING,
            temporal: { ...MOCK_STATUS_RUNNING.temporal!, elapsed_s: 7200 },
          }}
        />,
      );
      expect(screen.getByText(/Running for 2h$/)).toBeTruthy();
    });

    it('formats exact minutes with no seconds', () => {
      render(
        <SystemStatusView
          status={{
            ...MOCK_STATUS_RUNNING,
            temporal: { ...MOCK_STATUS_RUNNING.temporal!, elapsed_s: 120 },
          }}
        />,
      );
      expect(screen.getByText(/Running for 2m$/)).toBeTruthy();
    });
  });

  describe('running state', () => {
    it('renders all four section cards', () => {
      render(<SystemStatusView status={MOCK_STATUS_RUNNING} />);
      expect(screen.getByText('Pipeline')).toBeTruthy();
      expect(screen.getByText('Temporal')).toBeTruthy();
      expect(screen.getByText('Upload Queue')).toBeTruthy();
      expect(screen.getByText('Server')).toBeTruthy();
    });

    it('shows in progress label and stage for pipeline', () => {
      render(<SystemStatusView status={MOCK_STATUS_RUNNING} />);
      expect(screen.getByText('In progress')).toBeTruthy();
      expect(screen.getByText(/enrich_tree/)).toBeTruthy();
      expect(screen.getByText(/1m 17s/)).toBeTruthy();
    });

    it('shows running label and elapsed for temporal', () => {
      render(<SystemStatusView status={MOCK_STATUS_RUNNING} />);
      expect(screen.getByText('Running')).toBeTruthy();
      expect(screen.getByText(/Running for 2m/)).toBeTruthy();
    });

    it('shows queued depth and processing for upload queue', () => {
      render(<SystemStatusView status={MOCK_STATUS_RUNNING} />);
      expect(screen.getByText('Processing')).toBeTruthy();
      expect(screen.getByText('2 jobs queued')).toBeTruthy();
    });

    it('shows cpu and temperature for server', () => {
      render(<SystemStatusView status={MOCK_STATUS_RUNNING} />);
      expect(screen.getByText(/CPU 10%/)).toBeTruthy();
      expect(screen.getByText(/40 °C/)).toBeTruthy();
    });

    it('shows RAM in GB', () => {
      render(<SystemStatusView status={MOCK_STATUS_RUNNING} />);
      // 2048 MB → 2 GB, 8192 MB → 8 GB
      expect(screen.getByText(/2 \/ 8 GB/)).toBeTruthy();
    });

    it('shows disk in GB', () => {
      render(<SystemStatusView status={MOCK_STATUS_RUNNING} />);
      expect(screen.getByText(/200 \/ 500 GB/)).toBeTruthy();
    });
  });

  describe('idle state', () => {
    it('shows idle/done indicators for pipeline and temporal', () => {
      render(<SystemStatusView status={MOCK_STATUS_IDLE} />);
      // Both pipeline and temporal show ✓ prefix with Idle label
      const idleElements = screen.getAllByText(/✓ Idle/);
      expect(idleElements.length).toBeGreaterThanOrEqual(2);
    });

    it('shows last run info for pipeline', () => {
      render(<SystemStatusView status={MOCK_STATUS_IDLE} />);
      expect(screen.getByText(/Last run.*took 45m/)).toBeTruthy();
    });

    it('shows last run info for temporal', () => {
      render(<SystemStatusView status={MOCK_STATUS_IDLE} />);
      expect(screen.getByText(/Last run.*took 7m/)).toBeTruthy();
    });

    it('shows queue empty and idle for upload queue', () => {
      render(<SystemStatusView status={MOCK_STATUS_IDLE} />);
      expect(screen.getAllByText(/✓ Idle/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Queue empty')).toBeTruthy();
    });
  });

  describe('null pipeline/temporal', () => {
    it('shows no data indicator when pipeline is null', () => {
      render(
        <SystemStatusView status={{ ...MOCK_STATUS_IDLE, pipeline: null }} />,
      );
      expect(screen.getByText(/No data/)).toBeTruthy();
    });

    it('shows no last run line when last_finished_at is null', () => {
      render(
        <SystemStatusView
          status={{
            ...MOCK_STATUS_IDLE,
            pipeline: { ...MOCK_STATUS_IDLE.pipeline!, last_finished_at: null },
            temporal: { ...MOCK_STATUS_IDLE.temporal!, last_finished_at: null },
          }}
        />,
      );
      expect(screen.queryByText(/Last run/)).toBeNull();
    });
  });

  describe('singular upload queue depth', () => {
    it('uses singular job label when depth is 1', () => {
      render(
        <SystemStatusView
          status={{
            ...MOCK_STATUS_RUNNING,
            upload_queue: { depth: 1, active: false },
          }}
        />,
      );
      expect(screen.getByText('1 job queued')).toBeTruthy();
    });
  });
});
