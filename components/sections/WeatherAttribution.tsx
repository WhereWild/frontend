import { useDataSources } from '@/hooks/useDataSources';
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { ThemedText } from '../text/ThemedText';

const OPEN_METEO_ID = 'open_meteo';
const NCEP_ID = 'ncep_gfs_open_meteo';

export function WeatherAttribution() {
  const dataSources = useDataSources();
  const openMeteoSource = dataSources[OPEN_METEO_ID] ?? null;
  const openMeteoDoiUrl = openMeteoSource?.references[0]?.doi ?? null;
  const openMeteoLicenseUrl = openMeteoSource?.license_url ?? null;
  const ncepSource = dataSources[NCEP_ID] ?? null;
  const ncepDoiUrl = ncepSource?.references[0]?.doi ?? null;
  const ncepLicenseUrl = ncepSource?.license_url ?? null;
  const hasAttribution = openMeteoSource != null || ncepSource != null;

  return (
    <View
      collapsable={false}
      testID='weather-attribution-slot'
      accessibilityElementsHidden={!hasAttribution}
      importantForAccessibility={
        hasAttribution ? 'auto' : 'no-hide-descendants'
      }
      style={[styles.weatherAttribution, !hasAttribution && styles.hiddenSlot]}
    >
      {hasAttribution ? (
        <>
          <ThemedText variant='bodySmall'>
            {'Heatmap updated using data from '}
          </ThemedText>
          {openMeteoSource && (
            <>
              <ThemedText
                variant='bodySmallLink'
                onPress={() => Linking.openURL(openMeteoSource.url)}
              >
                {'Open-Meteo'}
              </ThemedText>
              {(openMeteoDoiUrl || openMeteoLicenseUrl) && (
                <>
                  <ThemedText variant='bodySmall'>{' ('}</ThemedText>
                  {openMeteoDoiUrl && (
                    <ThemedText
                      variant='bodySmallLink'
                      onPress={() => Linking.openURL(openMeteoDoiUrl)}
                    >
                      {'DOI'}
                    </ThemedText>
                  )}
                  {openMeteoDoiUrl && openMeteoLicenseUrl && (
                    <ThemedText variant='bodySmall'>{' · '}</ThemedText>
                  )}
                  {openMeteoLicenseUrl && (
                    <ThemedText
                      variant='bodySmallLink'
                      onPress={() => Linking.openURL(openMeteoLicenseUrl)}
                    >
                      {'License'}
                    </ThemedText>
                  )}
                  <ThemedText variant='bodySmall'>{')'}</ThemedText>
                </>
              )}
            </>
          )}
          {openMeteoSource && ncepSource && (
            <ThemedText variant='bodySmall'>{' and '}</ThemedText>
          )}
          {ncepSource && (
            <>
              <ThemedText
                variant='bodySmallLink'
                onPress={() => Linking.openURL(ncepSource.url)}
              >
                {'NCEP GFS'}
              </ThemedText>
              {(ncepDoiUrl || ncepLicenseUrl) && (
                <>
                  <ThemedText variant='bodySmall'>{' ('}</ThemedText>
                  {ncepDoiUrl && (
                    <ThemedText
                      variant='bodySmallLink'
                      onPress={() => Linking.openURL(ncepDoiUrl)}
                    >
                      {'DOI'}
                    </ThemedText>
                  )}
                  {ncepDoiUrl && ncepLicenseUrl && (
                    <ThemedText variant='bodySmall'>{' · '}</ThemedText>
                  )}
                  {ncepLicenseUrl && (
                    <ThemedText
                      variant='bodySmallLink'
                      onPress={() => Linking.openURL(ncepLicenseUrl)}
                    >
                      {'License'}
                    </ThemedText>
                  )}
                  <ThemedText variant='bodySmall'>{')'}</ThemedText>
                </>
              )}
            </>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  weatherAttribution: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  },
  hiddenSlot: {
    height: 0,
    opacity: 0,
    overflow: 'hidden',
  },
});
