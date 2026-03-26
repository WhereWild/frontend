import Head from 'expo-router/head';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { IconUpload } from '@/assets/icons';
import { Button, PageTitle, ThemedText } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { uploadRawObservations } from '@/data/api';

export default function Upload() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const isMobile = responsive.breakpoint === 'phone';
  const [isLoading, setIsLoading] = useState(false)

  const selectFileFromPicker = React.useCallback(
    async (acceptedExtensions: string): Promise<DocumentPicker.DocumentPickerAsset | undefined> => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: acceptedExtensions,
          copyToCacheDirectory: true,
          multiple: false,
        });

        if (result.canceled) {
          return undefined;
        }

        const file = result.assets[0];

        return file;
      } catch (error) {
        console.error('Error opening file picker or reading file:', error);
        return undefined;
      }
    },
    [],
  );

  const processRawObservations = React.useCallback(async () => {
    const file = await selectFileFromPicker('.csv, .tsv, .parquet');
    if (!file) {
      return;
    }

    try {
      const filePayload = file.file instanceof File
        ? file.file
        : {
          uri: file.uri,
          name: file.name,
          type: file.mimeType ?? 'application/octet-stream',
        };

      setIsLoading(true);

      const response = await uploadRawObservations({
        file: filePayload,
        filename: file.name,
      });

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const downloadFilename = response.filename ?? 'processed_observations.zip';
        const downloadUrl = URL.createObjectURL(response.blob);
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = downloadFilename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(downloadUrl);
      }

      console.log('Raw observations upload complete:', {
        status: response.status,
        filename: response.filename,
        contentType: response.contentType,
        size: response.blob.size,
      });
      setIsLoading(false);

    } catch (error) {
      console.error('Failed to upload raw observations file:', error);
      setIsLoading(false);
    }
  }, [selectFileFromPicker]);

  const processZippedObservations = React.useCallback(async() => {
    const file = await selectFileFromPicker('.zip');
    if (!file) {
      return;
    }
    // TODO send file to the backend, update page to show environmental data
    // Disable upload with loading message while data processes
  }, [selectFileFromPicker]);

  return (
    <>
      <Head>
        <title>WhereWild | Upload</title>
      </Head>

      <View testID="upload-screen" style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
        <ScrollView
          contentContainerStyle={[
            getResponsiveContentContainerStyle(responsive, {
              includeHorizontalPadding: false,
              includeBottomPadding: true,
              includeGap: true,
            }),
            styles.scrollContent,
          ]}
        >
          <PageTitle title="Upload Custom Data" />

          <View style={[styles.content, { maxWidth: responsive.contentWidth }]}>
            <ThemedText variant="body" style={styles.description}>
                Do you have your own set of observational data you would like to analyze? 
                Upload a list of coordinates here, and WhereWild will populate the
                observations with environmental data.
            </ThemedText>

            <View style={[styles.stepsRow, isMobile && styles.stepsColumn]}>
              <View
                style={[
                  styles.stepCard,
                  { backgroundColor: palette.background.default.secondary },
                ]}
              >
                <ThemedText variant="heading">Step 1</ThemedText>
                <ThemedText variant="body" style={styles.stepDescription}>
                  Upload raw observational data including separate fields for latitude and 
                  longitude. It will be processed and zipped. Supported file types: CSV, TSV, parquet.
                </ThemedText>
                <View style={styles.buttonRow}>
                  {isLoading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={palette.icon.brand.default} />
                      <ThemedText variant="body">Generating zip...</ThemedText>
                    </View>
                  ) : (
                    <Button 
                      iconStart={<IconUpload />}
                      disabled={isLoading}
                      label={"Upload"}
                      onPress={processRawObservations}
                    />
                  )}
                </View>
              </View>

              <View
                style={[
                  styles.stepCard,
                  { backgroundColor: palette.background.default.secondary },
                ]}
              >
                <ThemedText variant="heading">Step 2</ThemedText>
                <ThemedText variant="body" style={styles.stepDescription}>
                  Upload processed data as a zipped file to view the enhanced
                  data set including environmental insights.
                </ThemedText>
                <View style={styles.buttonRow}>
                  <Button 
                    iconStart={<IconUpload />}
                    label={"Upload"}
                    onPress={processZippedObservations}
                  />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
  stepCard: {
    flex: 1,
    borderRadius: Size.radius['200'],
    padding: Size.space['400'],
    gap: Size.space['300'],
  },
  stepDescription: {
    flexGrow: 1,
  },
  buttonRow: {
    width: '100%',
    minHeight: Size.control.height.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    minHeight: Size.control.height.medium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Size.space['400'],
  },
});
