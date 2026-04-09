import Head from 'expo-router/head';
import React from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { PageTitle, ThemedText, SelectField } from '@/components';
import { Colors, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { useSettings } from '@/context/SettingsContext';

export default function Settings() {
  const colorScheme = useColorScheme();
  const mode = colorScheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const responsive = useResponsive();
  const { region, setRegion, units, setUnits, language, setLanguage } =
    useSettings();
  const regionOptions = [
    { label: 'Utah', value: 'utah' },
    { label: 'California', value: 'california' },
    { label: 'New York', value: 'new-york' },
  ];

  const unitsOptions = [
    { label: 'Metric (°C, km)', value: 'metric' },
    { label: 'Imperial (°F, mi)', value: 'imperial' },
  ];

  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Español', value: 'es' },
    { label: 'Français', value: 'fr' },
  ];

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

      <View
        testID='settings-screen'
        style={[
          styles.screen,
          { backgroundColor: palette.background.default.default },
        ]}
      >
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
                    label='Region'
                    placeholder='Select a region'
                    options={regionOptions}
                    value={region}
                    onValueChange={setRegion}
                    description='Set your default observation region'
                  />

                  <SelectField
                    label='Language'
                    placeholder='Select language'
                    options={languageOptions}
                    value={language}
                    onValueChange={setLanguage}
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
