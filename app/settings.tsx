// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  PageTitle,
  ThemedText,
  SelectField,
  PageScrollContainer,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { IconChevronRight, IconInfo, IconUpload } from '@/assets/icons';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import {
  isColorModeOverride,
  isUnitSystem,
  useSettings,
} from '@/context/SettingsContext';
import { WebMetadata } from '@/utils/webMetadata';

const LOCATION_OPTIONS = [{ label: 'Utah', value: 'utah' }];

const UNITS_OPTIONS = [
  { label: 'Metric (°C, km)', value: 'metric' },
  { label: 'Imperial (°F, mi)', value: 'imperial' },
];

const LANGUAGE_OPTIONS = [{ label: 'English', value: 'en' }];

const COLOR_MODE_OPTIONS = [
  { label: 'Device default', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export default function Settings() {
  const router = useRouter();
  const responsive = useResponsive();
  const { units, setUnits, colorModeOverride, setColorModeOverride } =
    useSettings();

  const handleUnitsChange = (value: string) => {
    if (isUnitSystem(value)) {
      setUnits(value);
    }
  };

  const handleColorModeChange = (value: string) => {
    if (isColorModeOverride(value)) {
      setColorModeOverride(value);
    }
  };

  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Settings'
          description='Adjust your WhereWild preferences, including units and color theme.'
          path='/settings'
        />
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
          {Platform.OS === 'web' ? (
            <PageTitle
              title='Settings'
              contentMaxWidth={responsive.contentWidth}
            />
          ) : null}

          <View
            style={[
              styles.contentShell,
              Platform.OS !== 'web' && styles.contentShellNative,
              getResponsiveContentContainerStyle(responsive, {
                includeWidth: false,
                includeTopPadding: false,
              }),
            ]}
          >
            <View
              style={[
                styles.content,
                Platform.OS !== 'web' && styles.contentNative,
                Platform.OS === 'web' && styles.contentWeb,
                { maxWidth: responsive.contentWidth },
              ]}
            >
              <View style={styles.section}>
                <ThemedText variant='heading'>Localization</ThemedText>

                <View style={[styles.subsection, styles.fieldStack]}>
                  <SelectField
                    label='Color mode'
                    placeholder='Select color mode'
                    allowSearch={false}
                    options={COLOR_MODE_OPTIONS}
                    value={colorModeOverride}
                    onValueChange={handleColorModeChange}
                    description='Choose light, dark, or follow your device setting'
                  />

                  <SelectField
                    label='Location'
                    placeholder='Select a location'
                    options={LOCATION_OPTIONS}
                    value='utah'
                    disabled
                    description='Default observation location'
                  />

                  <SelectField
                    label='Language'
                    placeholder='Select language'
                    options={LANGUAGE_OPTIONS}
                    value='en'
                    disabled
                    description='Preferred UI language'
                  />

                  <SelectField
                    label='Units'
                    placeholder='Select units'
                    allowSearch={false}
                    options={UNITS_OPTIONS}
                    value={units}
                    onValueChange={handleUnitsChange}
                    description='Display temperatures and distances'
                  />
                </View>
              </View>

              {Platform.OS !== 'web' ? (
                <View style={styles.section}>
                  <ThemedText variant='heading'>About</ThemedText>

                  <View style={styles.subsection}>
                    <ThemedText variant='body'>
                      {'Find project background and team information in About.'}
                    </ThemedText>

                    <View style={styles.actionStack}>
                      <Button
                        variant='neutral'
                        label='Upload Custom Data'
                        onPress={() => router.push('/upload')}
                        iconStart={<IconUpload />}
                        iconEnd={<IconChevronRight />}
                        style={styles.actionButton}
                      />
                      <Button
                        variant='neutral'
                        label='About WhereWild'
                        onPress={() => router.push('/about')}
                        iconStart={<IconInfo />}
                        iconEnd={<IconChevronRight />}
                        style={styles.actionButton}
                      />
                    </View>
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {__DEV__ ? (
            <View style={styles.devSection}>
              <Button
                variant='neutral'
                label='Component Dev Page'
                onPress={() => router.push('/dev')}
                iconEnd={<IconChevronRight />}
                style={styles.actionButton}
              />
            </View>
          ) : null}
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
  contentShell: {
    width: '100%',
    alignItems: 'center',
  },
  contentShellNative: {
    alignItems: 'flex-start',
  },
  content: {
    alignSelf: 'center',
    gap: Size.space.text.section,
  },
  contentNative: {
    alignSelf: 'flex-start',
  },
  contentWeb: {
    width: '100%',
  },
  section: {
    gap: Size.space.text.subsection,
  },
  subsection: {
    gap: Size.space.text.paragraph,
  },
  fieldStack: {
    width: 240,
    maxWidth: '100%',
    alignItems: 'stretch',
  },
  actionStack: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: Size.space['200'],
  },
  actionButton: {
    alignSelf: 'stretch',
  },
  devSection: {
    width: '100%',
    paddingTop: Size.space['400'],
  },
});
