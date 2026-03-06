import Head from 'expo-router/head';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
  const { region, setRegion, units, setUnits, language, setLanguage } = useSettings();
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

  return (
    <>
      <Head>
        <title>WhereWild | Settings</title>
      </Head>

      <View testID="settings-screen" style={[styles.screen, { backgroundColor: palette.background.default.default }]}> 
        <ScrollView
          contentContainerStyle={getResponsiveContentContainerStyle(responsive, {
            includeBottomPadding: true,
            includeGap: true,
          })}
        >
          <PageTitle title="Settings" />

          <View style={[styles.sectionContent, getResponsiveContentContainerStyle(responsive, { includeWidth: false, includeTopPadding: false }), { maxWidth: responsive.contentWidth }]}>
            <ThemedText variant="heading">Localization</ThemedText>

            <View style={styles.filterContainer}>
              <View style={styles.filterRow}>
                <View style={styles.filterItem}>
                  <SelectField
                    label="Region"
                    placeholder="Select a region"
                    options={regionOptions}
                    value={region}
                    onValueChange={setRegion}
                    description="Set your default observation region"
                  />
                </View>

                <View style={styles.filterItem}>
                  <SelectField
                    label="Language"
                    placeholder="Select language"
                    options={languageOptions}
                    value={language}
                    onValueChange={setLanguage}
                    description="Preferred UI language"
                  />
                </View>

                <View style={styles.filterItem}>
                  <SelectField
                    label="Units"
                    placeholder="Select units"
                    options={unitsOptions}
                    value={units}
                    onValueChange={(v: string) => {
                      if (v === 'metric' || v === 'imperial') {
                        setUnits(v);
                      } else {
                        // Unexpected value — ignore or fallback to metric
                        // setUnits('metric');
                      }
                    }}
                    description="Display temperatures and distances"
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
  row: {
    marginTop: Size.space['600'],
    padding: Size.space['400'],
    borderRadius: Size.radius['200'],
    borderWidth: Size.stroke.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionContent: {
    width: '100%',
    gap: Size.space['400'],
    alignItems: 'flex-start',
  },
  filterContainer: {
    gap: Size.space['200'],
  },
  filterRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: Size.space['200'],
  },
  filterItem: {
    flexGrow: 1,
    maxWidth: 720,
  },
});
