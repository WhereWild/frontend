import { PageScrollContainer } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { PageTitle } from '@/components/sections/PageTitle';
import {
  SystemStatusView,
  type SystemStatusData,
} from '@/components/sections/status/SystemStatusView';
import { BACKEND_BASE } from '@/data/apiShared';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { WebMetadata } from '@/utils/webMetadata';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const POLL_INTERVAL_MS = 5_000;

const fetchStatus = async (): Promise<SystemStatusData> => {
  const response = await fetch(`${BACKEND_BASE}/status`);
  if (!response.ok) {
    throw new Error(`Server responded ${response.status}`);
  }
  return response.json() as Promise<SystemStatusData>;
};

export default function StatusPage() {
  const responsive = useResponsive();
  const [status, setStatus] = useState<SystemStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await fetchStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [poll]);

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Status'
          description='Live backend pipeline and server status.'
          path='/status'
        />
      ) : null}

      <PageSurface testID='status-screen'>
        <PageScrollContainer
          contentContainerStyle={[
            getResponsiveContentContainerStyle(responsive, {
              includeHorizontalPadding: false,
              includeBottomPadding: true,
              includeGap: true,
            }),
            styles.scrollContent,
          ]}
        >
          {Platform.OS === 'web' ? (
            <PageTitle
              title='Status'
              contentMaxWidth={responsive.contentWidth}
            />
          ) : null}

          <View
            style={[
              styles.content,
              { maxWidth: responsive.contentWidth },
              getResponsiveContentContainerStyle(responsive, {
                includeWidth: false,
                includeTopPadding: false,
              }),
            ]}
          >
            <SystemStatusView
              status={status}
              isLoading={isLoading}
              error={error}
            />
          </View>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
  },
});
