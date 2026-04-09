import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { PageScrollContainer, PageTitle, ThemedText } from '@/components';
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
  const isMobile = responsive.breakpoint === 'phone';
  const {
    highlightedCatalogs,
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
    <View
      testID='upload-screen'
      style={Platform.OS === 'web' ? styles.screenWeb : styles.screen}
    >
      <PageScrollContainer
        contentContainerStyle={[
          getResponsiveContentContainerStyle(responsive, {
            includeHorizontalPadding: false,
            includeBottomPadding: false,
            includeGap: true,
          }),
          styles.scrollContent,
        ]}
      >
        <PageTitle title='Upload Custom Data' />

        <View style={[styles.content, { maxWidth: responsive.contentWidth }]}>
          <ThemedText variant='body' style={styles.description}>
            Do you have your own set of observational data you would like to
            analyze? Upload a list of coordinates here, and WhereWild will
            populate the observations with environmental data.
          </ThemedText>

          <View style={[styles.stepsRow, isMobile && styles.stepsColumn]}>
            <UploadStepCard
              description='Upload raw observational data including separate fields for latitude and longitude. It will be processed and zipped. Supported file types: CSV, TSV, parquet.'
              disabled={isProcessingZipped}
              isLoading={isProcessingRaw}
              label='Upload'
              palette={palette}
              stepTitle='Step 1'
              onPress={processRawObservations}
            />
            <UploadStepCard
              description='Upload processed data as a zipped file to view the enhanced data set including environmental insights.'
              disabled={isProcessingRaw}
              isLoading={isProcessingZipped}
              label='Upload'
              palette={palette}
              stepTitle='Step 2'
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
      </PageScrollContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenWeb: {
    width: '100%',
  },
  scrollContent: {
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
    gap: Size.space['300'],
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
