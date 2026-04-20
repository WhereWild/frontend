import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { PageScrollContainer, PageTitle, ThemedText } from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Colors, Size } from '@/constants/theme';
import { useLayoutChrome } from '@/context/LayoutChromeContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { calculateObservationMapHeight } from '@/app/_species';
import { useUploadWorkflow } from '@/hooks/upload/useUploadWorkflow';
import { UploadPreview } from './UploadPreview';
import { UploadStepCard } from './UploadStepCard';

const SAFE_AREA_INSETS_FALLBACK = { top: 0, bottom: 0, left: 0, right: 0 };

function UploadStatusMessage({
  backgroundColor,
  message,
}: {
  backgroundColor: string;
  message: string;
}) {
  return (
    <View style={[styles.statusContainer, { backgroundColor }]}>
      <ThemedText variant='bodySmall' style={styles.uploadStatusText}>
        {message}
      </ThemedText>
    </View>
  );
}

export function UploadScreen() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const isStacked = responsive.breakpoint !== 'desktop';
  const {
    canDownloadProcessedZip,
    downloadProcessedZip,
    highlightedCatalogs,
    isDeliveringProcessedZip,
    isProcessingRaw,
    isProcessingZipped,
    rawUploadStatusMessage,
    uploadedBundle,
    uploadedDataSource,
    zipUploadError,
    zipUploadWarning,
    setHighlightedCatalogs,
    processRawObservations,
    processZippedObservations,
  } = useUploadWorkflow();

  const { webHeaderHeight } = useLayoutChrome();
  const safeAreaInsets = React.useContext(SafeAreaInsetsContext);
  const insets = safeAreaInsets ?? SAFE_AREA_INSETS_FALLBACK;
  const { height: viewportHeight } = useWindowDimensions();
  const observationMapHeight = React.useMemo(() => {
    return calculateObservationMapHeight({
      breakpoint: responsive.breakpoint,
      measuredWebHeaderHeight: webHeaderHeight,
      platform: Platform.OS,
      safeAreaBottom: insets.bottom,
      safeAreaTop: insets.top,
      viewportHeight,
    });
  }, [
    insets.bottom,
    insets.top,
    responsive.breakpoint,
    viewportHeight,
    webHeaderHeight,
  ]);

  return (
    <PageSurface testID='upload-screen'>
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
            title='Upload Custom Data'
            contentMaxWidth={responsive.contentWidth}
          />
        ) : null}

        <View
          testID='upload-content-shell'
          style={[
            styles.contentShell,
            getResponsiveContentContainerStyle(responsive, {
              includeWidth: false,
              includeTopPadding: false,
            }),
          ]}
        >
          <View
            testID='upload-content'
            style={[
              styles.content,
              { maxWidth: responsive.contentWidth, gap: responsive.gap },
            ]}
          >
            <ThemedText variant='body' style={styles.description}>
              Do you have your own set of observational data you would like to
              analyze? Upload a list of coordinates here, and WhereWild will
              populate the observations with environmental data.
            </ThemedText>

            <View
              style={[
                styles.stepsRow,
                { gap: responsive.gap },
                isStacked && styles.stepsColumn,
              ]}
            >
              <UploadStepCard
                description='Upload raw observational data including separate fields for latitude and longitude. It will be processed and zipped. Supported file types: CSV, TSV, parquet.'
                disabled={isProcessingZipped || isDeliveringProcessedZip}
                isLoading={isProcessingRaw}
                label='Upload'
                loadingLabel='Processing upload...'
                matchSiblingHeight={!isStacked}
                palette={palette}
                secondaryAction={
                  canDownloadProcessedZip
                    ? {
                        isLoading: isDeliveringProcessedZip,
                        label: 'Download ZIP',
                        loadingLabel: 'Preparing ZIP...',
                        onPress: downloadProcessedZip,
                      }
                    : undefined
                }
                stepTitle='Step 1'
                testID='upload-step-card-1'
                onPress={processRawObservations}
              />
              <UploadStepCard
                description='Upload processed data as a zipped file to view the enhanced data set including environmental insights.'
                disabled={isProcessingRaw}
                isLoading={isProcessingZipped}
                label='Upload'
                loadingLabel='Importing ZIP...'
                matchSiblingHeight={!isStacked}
                palette={palette}
                stepTitle='Step 2'
                testID='upload-step-card-2'
                onPress={processZippedObservations}
              />
            </View>

            {rawUploadStatusMessage ? (
              <UploadStatusMessage
                backgroundColor={palette.background.default.secondary}
                message={rawUploadStatusMessage}
              />
            ) : null}

            {zipUploadError ? (
              <UploadStatusMessage
                backgroundColor={palette.background.default.secondary}
                message={zipUploadError}
              />
            ) : null}

            {zipUploadWarning ? (
              <UploadStatusMessage
                backgroundColor={palette.background.default.secondary}
                message={zipUploadWarning}
              />
            ) : null}

            {uploadedBundle && uploadedDataSource ? (
              <UploadPreview
                highlightedCatalogs={highlightedCatalogs}
                height={observationMapHeight}
                uploadedBundle={uploadedBundle}
                uploadedDataSource={uploadedDataSource}
                onHighlightChange={setHighlightedCatalogs}
              />
            ) : null}
          </View>
        </View>
      </PageScrollContainer>
    </PageSurface>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
  },
  contentShell: {
    width: '100%',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    gap: Size.space['400'],
  },
  description: {
    width: '100%',
  },
  stepsRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  stepsColumn: {
    flexDirection: 'column',
  },
  statusContainer: {
    width: '100%',
    borderRadius: Size.radius['200'],
    padding: Size.space['300'],
  },
  uploadStatusText: {
    textAlign: 'center',
  },
});
