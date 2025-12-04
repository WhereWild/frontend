import { IconRotateCcw } from '@/assets/icons';
import { ButtonDanger, PageHeader, SelectField, SwitchField, ThemedText } from '@/components';
import { Colors, Responsive, Size } from '@/constants/theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import Head from 'expo-router/head';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

const REGION_OPTIONS = [
  { label: 'Utah', value: 'ut' },
  { label: 'Colorado', value: 'co' },
  { label: 'New Mexico', value: 'nm' },
  { label: 'Wyoming', value: 'wy' },
];

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'Spanish', value: 'es' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
];

const LENGTH_UNIT_OPTIONS = [
  { label: 'Metric (kilometers, meters)', value: 'metric' },
  { label: 'US imperial (miles, feet)', value: 'us-imperial' },
];

const RAINFALL_UNIT_OPTIONS = [
  { label: 'Metric (millimeters)', value: 'metric' },
  { label: 'US imperial (inches)', value: 'us-imperial' },
];

const TEMPERATURE_UNIT_OPTIONS = [
  { label: 'Celsius (°C)', value: 'celsius' },
  { label: 'Fahrenheit (°F)', value: 'fahrenheit' },
  { label: 'Kelvin (K)', value: 'kelvin' },
];

const DEFAULT_SETTINGS = {
  region: REGION_OPTIONS[0].value,
  language: LANGUAGE_OPTIONS[0].value,
  lengthUnits: LENGTH_UNIT_OPTIONS[0].value,
  rainfallUnits: RAINFALL_UNIT_OPTIONS[0].value,
  temperatureUnits: TEMPERATURE_UNIT_OPTIONS[0].value,
  email: true,
  push: false,
  demoSwitch: false,
} as const;

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const mode = scheme === 'dark' ? 'dark' : 'light';
  const palette = Colors[mode];
  const [region, setRegion] = useState<string>(DEFAULT_SETTINGS.region);
  const [language, setLanguage] = useState<string>(DEFAULT_SETTINGS.language);
  const [lengthUnits, setLengthUnits] = useState<string>(DEFAULT_SETTINGS.lengthUnits);
  const [rainfallUnits, setRainfallUnits] = useState<string>(DEFAULT_SETTINGS.rainfallUnits);
  const [temperatureUnits, setTemperatureUnits] = useState<string>(DEFAULT_SETTINGS.temperatureUnits);
  const [emailNotifications, setEmailNotifications] = useState<boolean>(DEFAULT_SETTINGS.email);
  const [pushNotifications, setPushNotifications] = useState<boolean>(DEFAULT_SETTINGS.push);
  const [demoSwitchEnabled, setDemoSwitchEnabled] = useState<boolean>(DEFAULT_SETTINGS.demoSwitch);

  const handleRestoreDefaults = useCallback(() => {
    setRegion(DEFAULT_SETTINGS.region);
    setLanguage(DEFAULT_SETTINGS.language);
    setLengthUnits(DEFAULT_SETTINGS.lengthUnits);
    setRainfallUnits(DEFAULT_SETTINGS.rainfallUnits);
    setTemperatureUnits(DEFAULT_SETTINGS.temperatureUnits);
    setEmailNotifications(DEFAULT_SETTINGS.email);
    setPushNotifications(DEFAULT_SETTINGS.push);
    setDemoSwitchEnabled(DEFAULT_SETTINGS.demoSwitch);
  }, []);

  return (
    <>
      <Head>
        <title>WhereWild | Settings</title>
      </Head>

      <View style={[styles.screen, { backgroundColor: palette.background.default.default }]}>
        <PageHeader />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={styles.pageTitleContainer}>
            <View style={styles.pageTitle}>
              <ThemedText variant="titlePage">User Settings</ThemedText>
              <View style={[styles.pageTitleDivider, { backgroundColor: palette.border.brand.secondary }]} />
            </View>
          </View>

          <View style={styles.settingsColumn}>

            <View style={styles.section}>
              <ThemedText variant="heading">Localization</ThemedText>
              <View style={styles.fieldGroup}>
                <View style={styles.field}>
                  <SelectField
                    label="State"
                    options={REGION_OPTIONS}
                    value={region}
                    onValueChange={setRegion}
                    disabled
                  />
                </View>
                <View style={styles.field}>
                  <SelectField
                    label="Language"
                    options={LANGUAGE_OPTIONS}
                    value={language}
                    onValueChange={setLanguage}
                    disabled
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText variant="heading">Measurement Units</ThemedText>
              <View style={styles.fieldGroup}>
                <View style={styles.field}>
                  <SelectField
                    label="Length Units"
                    description="Choose between metric and US imperial distance scales"
                    options={LENGTH_UNIT_OPTIONS}
                    value={lengthUnits}
                    onValueChange={setLengthUnits}
                  />
                </View>
                <View style={styles.field}>
                  <SelectField
                    label="Rainfall Units"
                    description="Switch between millimeters and US imperial inches"
                    options={RAINFALL_UNIT_OPTIONS}
                    value={rainfallUnits}
                    onValueChange={setRainfallUnits}
                  />
                </View>
                <View style={styles.field}>
                  <SelectField
                    label="Temperature Units"
                    description="Supports °C, °F (US imperial), or Kelvin"
                    options={TEMPERATURE_UNIT_OPTIONS}
                    value={temperatureUnits}
                    onValueChange={setTemperatureUnits}
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText variant="heading">Notifications</ThemedText>
              <View style={styles.fieldGroup}>
                <View style={styles.switchField}>
                  <SwitchField
                    label="Email"
                    value={emailNotifications}
                    onValueChange={setEmailNotifications}
                    disabled
                  />
                </View>
                <View style={styles.switchField}>
                  <SwitchField
                    label="Push Notification"
                    value={pushNotifications}
                    onValueChange={setPushNotifications}
                    disabled
                  />
                </View>
                <View style={styles.switchField}>
                  <SwitchField
                    label="Demo Switch"
                    description="This is a demonstration switch to play with"
                    value={demoSwitchEnabled}
                    onValueChange={setDemoSwitchEnabled}
                  />
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText variant="heading">Danger Zone</ThemedText>
              <ButtonDanger
                accessibilityLabel="Restore default settings"
                iconStart={<IconRotateCcw />}
                style={styles.dangerButton}
                onPress={handleRestoreDefaults}
              >
                Restore default settings
              </ButtonDanger>
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
  content: {
    width: '100%',
    paddingTop: Size.space['800'],
    paddingBottom: Size.space['800'],
    paddingHorizontal: Responsive.marginHorizontal,
    alignItems: 'center',
    gap: Size.space['600'],
  },
  pageTitleContainer: {
    width: '100%',
    alignItems: 'center',
  },
  settingsColumn: {
    width: '100%',
    maxWidth: Responsive.textWidth,
    gap: Size.space['600'],
  },
  pageTitle: {
    width: '100%',
    maxWidth: Responsive.contentWidth,
    gap: Size.space['100'],
  },
  pageTitleDivider: {
    height: Size.stroke.border,
    width: '100%',
  },
  section: {
    gap: Size.space['300'],
  },
  fieldGroup: {
    gap: Size.space['300'],
  },
  field: {
    maxWidth: Size.space['8000'],
  },
  switchField: {
    maxWidth: Size.space['8000'],
  },
  dangerButton: {
    alignSelf: 'flex-start',
  },
});