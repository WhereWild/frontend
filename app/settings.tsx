import Head from 'expo-router/head';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  PageTitle,
  ThemedText,
  SelectField,
  PageScrollContainer,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { useSettings } from '@/context/SettingsContext';

export default function Settings() {
  const responsive = useResponsive();
  const { units, setUnits } = useSettings();
  const locationOptions = [{ label: 'Utah', value: 'utah' }];

  const unitsOptions = [
    { label: 'Metric (°C, km)', value: 'metric' },
    { label: 'Imperial (°F, mi)', value: 'imperial' },
  ];

  const languageOptions = [{ label: 'English', value: 'en' }];

  const handleUnitsChange = (value: string) => {
    if (value === 'metric' || value === 'imperial') {
      setUnits(value);
    }
  };

  return (
    <>
      {Platform.OS === 'web' ? (
        <Head>
          <title>WhereWild | Settings</title>
        </Head>
      ) : null}

      <PageSurface testID='settings-screen'>
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
          <PageTitle title='Settings' />

          <View
            style={[
              styles.sectionShell,
              getResponsiveContentContainerStyle(responsive, {
                includeWidth: false,
                includeTopPadding: false,
              }),
            ]}
          >
            <View
              style={[
                styles.sectionContent,
                { maxWidth: responsive.contentWidth },
              ]}
            >
              <View style={styles.settingsColumn}>
                <ThemedText variant='heading'>Localization</ThemedText>

                <View style={styles.fieldStack}>
                  <SelectField
                    label='Location'
                    placeholder='Select a location'
                    options={locationOptions}
                    value='utah'
                    disabled
                    description='Default observation location'
                  />

                  <SelectField
                    label='Language'
                    placeholder='Select language'
                    options={languageOptions}
                    value='en'
                    disabled
                    description='Preferred UI language'
                  />

                  <SelectField
                    label='Units'
                    placeholder='Select units'
                    options={unitsOptions}
                    value={units}
                    onValueChange={handleUnitsChange}
                    description='Display temperatures and distances'
                  />
                </View>
              </View>
            </View>
          </View>

          {/* Notifications and Danger Zone intentionally omitted per design instructions */}
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
  },
  sectionShell: {
    width: '100%',
    alignItems: 'center',
  },
  sectionContent: {
    width: '100%',
    alignItems: 'flex-start',
  },
  settingsColumn: {
    width: 240,
    maxWidth: 800,
    alignItems: 'flex-start',
    gap: Size.space['400'],
  },
  fieldStack: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: Size.space['200'],
  },
});
