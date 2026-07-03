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
import { SwitchField } from '@/components/inputs/SwitchField';
import { PageSurface } from '@/components/PageSurface';
import { IconChevronRight, IconInfo, IconUpload } from '@/assets/icons';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import {
  isColorModeOverride,
  isColormapId,
  isCircularColormapId,
  isCbMode,
  isUnitSystem,
  useSettings,
  type CbMode,
} from '@/context/SettingsContext';
import {
  COLORMAPS,
  COLORMAP_ORDER,
  CIRCULAR_COLORMAPS,
  CIRCULAR_COLORMAP_ORDER,
} from '@/components/sections/speciesOccurrenceMap/variableColors';
import { WebMetadata } from '@/utils/webMetadata';

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
  const {
    units,
    setUnits,
    colorModeOverride,
    setColorModeOverride,
    colormap,
    setColormap,
    circularColormap,
    setCircularColormap,
    cbMode,
    setCbMode,
    shapesEnabled,
    setShapesEnabled,
    markerOutlineEnabled,
    setMarkerOutlineEnabled,
    localLat,
    localLon,
  } = useSettings();

  const COLORMAP_OPTIONS = COLORMAP_ORDER.map((id) => ({
    label: COLORMAPS[id].label,
    value: id,
  }));
  const CIRCULAR_COLORMAP_OPTIONS = CIRCULAR_COLORMAP_ORDER.map((id) => ({
    label: CIRCULAR_COLORMAPS[id].label,
    value: id,
  }));

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

  const handleColormapChange = (value: string) => {
    if (isColormapId(value)) setColormap(value);
  };

  const handleCircularColormapChange = (value: string) => {
    if (isCircularColormapId(value)) setCircularColormap(value);
  };

  const CB_MODE_OPTIONS = [
    { label: 'Default', value: 'none' },
    { label: 'Colorblind friendly', value: 'colorblind' },
    { label: 'Monochrome friendly', value: 'achromatopsia' },
  ];

  const handleCbModeChange = (value: string) => {
    if (value === 'none') {
      setCbMode(null);
      return;
    }
    if (isCbMode(value)) setCbMode(value as CbMode);
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
              <View style={styles.sectionRow}>
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

                    <View style={styles.locationEntry}>
                      <Button
                        variant='neutral'
                        label='Local comparison location'
                        onPress={() => router.push('/home-region')}
                        style={styles.actionButton}
                      />
                      <ThemedText variant='bodyTiny' style={styles.locationHint}>
                        {localLat != null && localLon != null
                          ? `${localLat.toFixed(4)}, ${localLon.toFixed(4)}`
                          : 'Not set'}
                      </ThemedText>
                    </View>

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

                <View style={styles.section}>
                  <ThemedText variant='heading'>Map display</ThemedText>

                  <View style={[styles.subsection, styles.fieldStack]}>
                    <SelectField
                      label='Sequential colormap'
                      placeholder='Select colormap'
                      allowSearch={false}
                      options={COLORMAP_OPTIONS}
                      value={colormap}
                      onValueChange={handleColormapChange}
                      description='Color ramp for continuous variables (elevation, temperature, etc.)'
                    />

                    <SelectField
                      label='Circular colormap'
                      placeholder='Select circular colormap'
                      allowSearch={false}
                      options={CIRCULAR_COLORMAP_OPTIONS}
                      value={circularColormap}
                      onValueChange={handleCircularColormapChange}
                      description='Color wheel for directional variables (aspect)'
                    />

                    <SelectField
                      label='Color accessibility'
                      placeholder='Select mode'
                      allowSearch={false}
                      options={CB_MODE_OPTIONS}
                      value={cbMode ?? 'none'}
                      onValueChange={handleCbModeChange}
                      description='Adjust colors and shapes for color vision differences'
                    />
                    <SwitchField
                      label='Show category shapes'
                      description='Display a distinct shape per category alongside color'
                      value={shapesEnabled}
                      onValueChange={setShapesEnabled}
                    />
                    <SwitchField
                      label='Marker outlines'
                      description='Add a gray outline around markers for contrast on dark tiles'
                      value={markerOutlineEnabled}
                      onValueChange={setMarkerOutlineEnabled}
                    />
                  </View>
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
  sectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Size.space.text.section,
    alignItems: 'flex-start',
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
  hint: {
    opacity: 0.65,
    marginTop: -Size.space.text.paragraph / 2,
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
  locationEntry: {
    gap: Size.space['100'],
  },
  locationHint: {
    opacity: 0.6,
    paddingLeft: Size.space['100'],
    fontVariant: ['tabular-nums'] as const,
  },
});
