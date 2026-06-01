import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/text/ThemedText';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PipelineStatusData = {
  status: string;
  stage?: string | null;
  stage_elapsed_s?: number | null;
  last_finished_at?: string | null;
  last_duration_s?: number | null;
  received_at?: string | null;
};

export type TemporalStatusData = {
  status: string;
  elapsed_s?: number | null;
  last_finished_at?: string | null;
  last_duration_s?: number | null;
  received_at?: string | null;
};

export type UploadQueueStatusData = {
  depth: number;
  active: boolean;
};

export type ServerStatusData = {
  cpu_percent: number;
  cpu_temp_c: number;
  ram_used_mb: number;
  ram_total_mb: number;
  disk_used_gb: number;
  disk_total_gb: number;
};

export type SystemStatusData = {
  pipeline: PipelineStatusData | null;
  temporal: TemporalStatusData | null;
  upload_queue: UploadQueueStatusData;
  server: ServerStatusData;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatElapsed = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
};

const formatTimeAgo = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const formatNumber = (n: number, decimals = 0): string =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

type StatusKind = 'running' | 'done' | 'error' | 'idle';

const resolveKind = (status: string): StatusKind => {
  const s = status.toLowerCase();
  if (s === 'in_progress' || s === 'running') return 'running';
  if (s === 'done' || s === 'completed' || s === 'idle') return 'done';
  if (s === 'error' || s === 'failed') return 'error';
  return 'idle';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type StatusIndicatorProps = {
  kind: StatusKind;
  label: string;
};

function StatusIndicator({ kind, label }: StatusIndicatorProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  if (kind === 'running') {
    return (
      <View style={styles.indicatorRow}>
        <ActivityIndicator
          size='small'
          color={palette.text.brand.default}
          style={styles.spinner}
        />
        <ThemedText
          variant='bodySmallStrong'
          style={{ color: palette.text.brand.default }}
        >
          {label}
        </ThemedText>
      </View>
    );
  }

  if (kind === 'done') {
    return (
      <View style={styles.indicatorRow}>
        <ThemedText
          variant='bodySmallStrong'
          style={{ color: palette.text.positive.default }}
        >
          {'✓'} {label}
        </ThemedText>
      </View>
    );
  }

  if (kind === 'error') {
    return (
      <View style={styles.indicatorRow}>
        <ThemedText
          variant='bodySmallStrong'
          style={{ color: palette.text.danger.default }}
        >
          {'✗'} {label}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.indicatorRow}>
      <ThemedText
        variant='bodySmallStrong'
        style={{ color: palette.text.default.secondary }}
      >
        {'—'} {label}
      </ThemedText>
    </View>
  );
}

type ResourceBarProps = {
  label: string;
  used: number;
  total: number;
  unit: string;
};

function ResourceBar({ label, used, total, unit }: ResourceBarProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const fraction = total > 0 ? Math.min(used / total, 1) : 0;
  const pct = Math.round(fraction * 100);

  const barColor =
    pct >= 90
      ? palette.text.danger.default
      : pct >= 70
        ? palette.text.warning.default
        : palette.text.brand.default;

  return (
    <View style={styles.resourceRow}>
      <ThemedText
        variant='singleLineBodyTiny'
        style={[
          styles.resourceLabel,
          { color: palette.text.default.secondary },
        ]}
      >
        {label}
      </ThemedText>
      <View
        style={[
          styles.resourceBarTrack,
          { borderColor: palette.border.default.tertiary },
        ]}
      >
        <View
          style={[
            styles.resourceBarFill,
            { width: `${pct}%` as `${number}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <ThemedText
        variant='singleLineBodyTiny'
        style={{ color: palette.text.default.secondary }}
      >
        {formatNumber(used)} / {formatNumber(total)} {unit}
      </ThemedText>
    </View>
  );
}

type StatusCardProps = {
  title: string;
  children: React.ReactNode;
};

function StatusCard({ title, children }: StatusCardProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.background.default.secondary,
          borderColor: palette.border.default.tertiary,
        },
      ]}
    >
      <ThemedText variant='subheading'>{title}</ThemedText>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

function PipelineCard({ data }: { data: PipelineStatusData | null }) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  if (!data) {
    return (
      <StatusCard title='Pipeline'>
        <StatusIndicator kind='idle' label='No data' />
      </StatusCard>
    );
  }

  const kind = resolveKind(data.status);
  const statusLabel =
    kind === 'running'
      ? 'In progress'
      : kind === 'done'
        ? data.status === 'idle'
          ? 'Idle'
          : 'Done'
        : kind === 'error'
          ? 'Error'
          : data.status;

  return (
    <StatusCard title='Pipeline'>
      <StatusIndicator kind={kind} label={statusLabel} />
      {data.stage ? (
        <ThemedText
          variant='bodySmall'
          style={{ color: palette.text.default.secondary }}
        >
          Stage: {data.stage}
          {data.stage_elapsed_s != null
            ? `  ·  ${formatElapsed(data.stage_elapsed_s)}`
            : ''}
        </ThemedText>
      ) : null}
      {data.last_finished_at ? (
        <ThemedText
          variant='bodyTiny'
          style={{ color: palette.text.default.tertiary }}
        >
          {`Last run ${formatTimeAgo(data.last_finished_at)}${data.last_duration_s != null ? `, took ${formatElapsed(data.last_duration_s)}` : ''}`}
        </ThemedText>
      ) : null}
    </StatusCard>
  );
}

function TemporalCard({ data }: { data: TemporalStatusData | null }) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  if (!data) {
    return (
      <StatusCard title='Temporal'>
        <StatusIndicator kind='idle' label='No data' />
      </StatusCard>
    );
  }

  const kind = resolveKind(data.status);
  const statusLabel =
    kind === 'running' ? 'Running' : kind === 'done' ? 'Idle' : data.status;

  return (
    <StatusCard title='Temporal'>
      <StatusIndicator kind={kind} label={statusLabel} />
      {kind === 'running' && data.elapsed_s != null ? (
        <ThemedText
          variant='bodySmall'
          style={{ color: palette.text.default.secondary }}
        >
          Running for {formatElapsed(data.elapsed_s)}
        </ThemedText>
      ) : null}
      {data.last_finished_at ? (
        <ThemedText
          variant='bodyTiny'
          style={{ color: palette.text.default.tertiary }}
        >
          {`Last run ${formatTimeAgo(data.last_finished_at)}${data.last_duration_s != null ? `, took ${formatElapsed(data.last_duration_s)}` : ''}`}
        </ThemedText>
      ) : null}
    </StatusCard>
  );
}

function UploadQueueCard({ data }: { data: UploadQueueStatusData }) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  const kind: StatusKind = data.active ? 'running' : 'done';

  return (
    <StatusCard title='Upload Queue'>
      <StatusIndicator
        kind={kind}
        label={data.active ? 'Processing' : 'Idle'}
      />
      <ThemedText
        variant='bodySmall'
        style={{ color: palette.text.default.secondary }}
      >
        {data.depth === 0
          ? 'Queue empty'
          : `${data.depth} job${data.depth === 1 ? '' : 's'} queued`}
      </ThemedText>
    </StatusCard>
  );
}

function ServerCard({ data }: { data: ServerStatusData }) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  return (
    <StatusCard title='Server'>
      <ThemedText
        variant='bodySmall'
        style={{ color: palette.text.default.secondary }}
      >
        CPU {data.cpu_percent}% · {data.cpu_temp_c} °C
      </ThemedText>
      <ResourceBar
        label='RAM'
        used={Math.round(data.ram_used_mb / 1024)}
        total={Math.round(data.ram_total_mb / 1024)}
        unit='GB'
      />
      <ResourceBar
        label='Disk'
        used={data.disk_used_gb}
        total={data.disk_total_gb}
        unit='GB'
      />
    </StatusCard>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export type SystemStatusViewProps = {
  status: SystemStatusData | null;
  isLoading?: boolean;
  error?: string | null;
};

export function SystemStatusView({
  status,
  isLoading = false,
  error = null,
}: SystemStatusViewProps) {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];

  if (isLoading && !status) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator size='large' color={palette.text.brand.default} />
      </View>
    );
  }

  if (error && !status) {
    return (
      <View style={styles.centerState}>
        <ThemedText
          variant='body'
          style={{ color: palette.text.danger.default }}
        >
          {'✗'} {error}
        </ThemedText>
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.centerState}>
        <ThemedText
          variant='body'
          style={{ color: palette.text.default.secondary }}
        >
          No status available
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      <PipelineCard data={status.pipeline} />
      <TemporalCard data={status.temporal} />
      <UploadQueueCard data={status.upload_queue} />
      <ServerCard data={status.server} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  grid: {
    gap: Size.space['300'],
  },
  card: {
    borderRadius: Size.radius['400'],
    borderWidth: Size.stroke.border,
    padding: Size.space['400'],
    gap: Size.space['200'],
  },
  cardBody: {
    gap: Size.space['150'],
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['150'],
  },
  spinner: {
    width: 16,
    height: 16,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Size.space['200'],
  },
  resourceLabel: {
    width: 28,
  },
  resourceBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
    borderWidth: 1,
    overflow: 'hidden',
  },
  resourceBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  centerState: {
    paddingVertical: Size.space['600'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
